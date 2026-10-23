# Frontend (Next.js)

Interfaz web de la aplicación, en `frontend/`. Next.js 16 con App Router, React 19, TypeScript estricto y Tailwind CSS 4.

## Lectura y escritura

- **Lee** con Prisma, directamente de PostgreSQL, desde Server Components (`lib/tasks.ts`).
- **Nunca escribe** con Prisma. Toda creación, edición o borrado pasa por la API de Express, que es la única que valida y escribe (ver [`api.md`](api.md)). Antes de cada commit, esta búsqueda debe salir vacía:

  ```bash
  git grep -n -E 'prisma\.task\.(create|update|delete|upsert)' -- frontend
  ```

## Estructura

| Ruta | Qué es | Server o Client |
|---|---|---|
| `app/layout.tsx` | Layout raíz: idioma, metadatos y estilos base. | Server |
| `app/page.tsx` | Página principal: título, formulario y, dentro de `<Suspense>`, pestañas y lista. | Server |
| `app/error.tsx` | Lo que se muestra si la página falla al leer (por ejemplo, la base caída), con botón «Reintentar». | Client |
| `components/NewTaskForm.tsx` | Formulario de nueva tarea: título obligatorio, descripción opcional, error en pantalla. | Client |
| `components/StatusTabs.tsx` | Pestañas Todas / Pendientes / Completadas con contador. Son enlaces: no necesitan JavaScript en el navegador. | Server |
| `components/TaskList.tsx` | Lista de tareas del filtro actual y mensaje de lista vacía. Formatea las fechas y pasa datos planos a cada fila. | Server |
| `components/TaskItem.tsx` | Una fila: casilla para completar o reabrir, botón «Eliminar» y el error de esa fila. | Client |
| `app/api/tasks/route.ts` | Route Handler de `GET` (con `?completed=`) y `POST /api/tasks`: reenvía a Express. | Server |
| `app/api/tasks/[id]/route.ts` | Route Handler de `PUT` y `DELETE /api/tasks/:id`: reenvía a Express. | Server |
| `lib/backend.ts` | El reenvío a `${BACKEND_URL}`: mismo método, cuerpo, status y respuesta; 502 o 504 si Express no contesta. | Solo servidor |
| `lib/api.ts` | Llamadas de escritura a `/api/tasks` desde el navegador y traducción de los errores de Express a mensajes en español. | Navegador |
| `lib/prisma.ts` | Cliente de Prisma compartido (singleton en `globalThis` para el modo dev). | Solo servidor |
| `lib/tasks.ts` | Filtro de la URL (`parseStatusFilter`) y consultas: `listTasks`, `countTasks`. | Solo servidor |
| `lib/format.ts` | Fecha relativa en español («hace 5 minutos», «ayer»). | Ambos |
| `generated/prisma/` | Cliente de Prisma generado. **No se versiona ni se edita**: se regenera solo. | Solo servidor |
| `prisma.config.ts` | Le dice al CLI de Prisma dónde está el schema (`../backend/prisma/schema.prisma`). | — |
| `next.config.ts` | Carga el `.env` de la raíz del repositorio y activa Cache Components. | — |

`lib/prisma.ts`, `lib/tasks.ts` y `lib/backend.ts` importan `server-only`: si un Client Component los importa por error, el build falla en lugar de mandar el cliente de la base al navegador.

**Server o Client:** todo es Server Component salvo lo que necesita estado o eventos del navegador: el formulario (`NewTaskForm`), cada fila con sus botones (`TaskItem`) y `error.tsx` (Next exige que los límites de error sean Client). Así la lista llega como HTML ya armado y el JavaScript que descarga el navegador es mínimo. `TaskList` sigue en el servidor: calcula «hace 5 minutos» una sola vez y le pasa a `TaskItem` texto ya listo, así servidor y navegador pintan lo mismo (sin avisos de hidratación).

## Cómo fluye una mutación

```
Client Component ──fetch──▶ /api/tasks (Route Handler de Next) ──▶ Express ──▶ PostgreSQL
       ▲                                                                          │
       └──── router.refresh(): el servidor vuelve a leer con Prisma ◀─────────────┘
```

1. El componente llama a `createTask`, `setTaskCompleted` o `deleteTask` de `lib/api.ts` dentro de `startTransition` (`useTransition`). Mientras espera, los controles quedan deshabilitados («Agregando…», la fila parpadea).
2. Si la respuesta es correcta, `router.refresh()` le pide al servidor la página otra vez: la lista y los contadores salen de la base, no de un parche en el navegador.
3. Si falla, `lib/api.ts` lanza un `ApiError` con un mensaje en español elegido por el `code` de Express (o por el campo inválido) y el componente lo muestra con `role="alert"`: debajo del formulario o dentro de la fila.

## Route Handlers: el puente con Express

El navegador solo habla con Next (`/api/tasks`, mismo origen: sin CORS y sin exponer la dirección de Express). Los Route Handlers no validan nada: `lib/backend.ts` reenvía método, cuerpo crudo y query string a `${BACKEND_URL}` y devuelve **el mismo status y el mismo cuerpo** que Express. Así las reglas y los códigos de error viven en un solo lugar ([`api.md`](api.md)).

| Situación | Respuesta de `/api/tasks…` |
|---|---|
| Express responde (éxito o error) | Su status y su cuerpo, sin cambios (201, 200, 204, 400, 404, 413, 500, 503). |
| Express no está corriendo o `BACKEND_URL` es incorrecta | `502` `{"error":{"code":"BACKEND_UNAVAILABLE",…}}`, y el detalle va al log de Next. |
| Express no contesta en 10 s | `504` `{"error":{"code":"BACKEND_TIMEOUT",…}}`. |

Los dos códigos propios usan el formato de error de Express, así `lib/api.ts` los trata igual que los demás.

**Tipos:** `ApiTask` (en `lib/api.ts`) es la forma de una tarea en JSON y coincide con la respuesta de Express. Se diferencia del `Task` de Prisma solo en `createdAt`, que viaja como texto ISO 8601; no se vuelve a convertir a `Date` porque, tras cada cambio, la lista se relee en el servidor con Prisma (que ya entrega `Date`).

```bash
# con la base, Express (:4000) y Next (:3000) arriba
curl localhost:3000/api/tasks?completed=false
curl -X POST localhost:3000/api/tasks -H 'Content-Type: application/json' -d '{"title":"Comprar pan"}'
```

**Cómo se agrega una acción** (por ejemplo, editar el título): una función nueva en `lib/api.ts` que llame al endpoint de Express ya existente (`PUT` con `title`), y en `TaskItem` un control que la use con `run(...)`, que ya trae el estado de espera, el error y el refresco.

## Errores

- **Al escribir:** el mensaje va junto a lo que falló (formulario o fila); el resto de la página sigue usable.
- **Al leer:** si Prisma no llega a la base, la lista (que va por streaming dentro de `<Suspense>`) falla y Next pinta `app/error.tsx` en su lugar. En producción el navegador no recibe el detalle, solo un `digest` que coincide con el error completo en el log del servidor. «Reintentar» llama a `retry()` (Next 16.3+), que vuelve a pedir la página al servidor.

## El cliente de Prisma

El schema vive solo en `backend/prisma/schema.prisma` (dueño único, con sus migraciones). Su bloque `generator` escribe el cliente en `frontend/generated/prisma/`. Se regenera con `npm run prisma:generate`, que ya corren solos `dev`, `build` y `typecheck`. Después de una migración nueva en el backend, basta con volver a correr cualquiera de ellos.

Prisma 7 necesita un *driver adapter*: el cliente se crea con `@prisma/adapter-pg` sobre `DATABASE_URL`. Desde el frontend nunca se corre `prisma migrate`.

## Variables de entorno

Next.js solo lee `.env` de su propia carpeta. El proyecto tiene un único `.env` en la raíz del repositorio, así que `next.config.ts` lo carga con `dotenv`; las variables que ya existen en el entorno (Docker, CI) tienen prioridad. El frontend usa `DATABASE_URL` (lectura con Prisma) y `BACKEND_URL` (reenvío de escrituras a Express). Ninguna lleva el prefijo `NEXT_PUBLIC_`, así que ninguna llega al navegador.

## Render: Cache Components y `<Suspense>`

`cacheComponents` está activo (el valor por defecto de Next 16 para apps nuevas). Con él, los datos son dinámicos salvo que se marquen con `"use cache"`, y lo que depende de la petición (`searchParams`, la base) debe ir dentro de `<Suspense>`. Por eso `app/page.tsx` prerenderiza el título como estructura estática y transmite pestañas y lista al llegar los datos. `next build` marca `/` con `◐ (Partial Prerender)`. La lista siempre refleja la base: no se cachea nada.

En Next 16, `searchParams` es una `Promise` y se lee con `await`.

## Filtros

El filtro va en la URL con el mismo parámetro que la API: `/` (todas), `/?completed=false` (pendientes), `/?completed=true` (completadas). Un valor distinto muestra todas. Las consultas usan el índice `(completed, created_at DESC)` (ver [`database.md`](database.md)).

**Cómo se agrega un filtro** (por ejemplo, buscar por texto con `?q=`):

1. En `lib/tasks.ts`, leer el parámetro nuevo y añadir la condición al `where` de `listTasks` (y de `countTasks` si los contadores deben respetarla).
2. En `app/page.tsx`, pasar el parámetro desde `await searchParams`.
3. En `components/StatusTabs.tsx`, conservar el parámetro en los `href` de las pestañas.
4. Si el filtro también debe existir en la API, añadirlo antes en Express ([`api.md`](api.md)).

## Comandos

```bash
cd frontend
npm ci                          # instala y aprueba solo los scripts de Prisma (allowScripts)
npm run dev                     # http://localhost:3000 (requiere la base levantada)
npm run lint                    # ESLint con la configuración de Next
npm run typecheck               # tipos de rutas + tsc
npm run build && npm start      # build de producción y servidor en :3000
```

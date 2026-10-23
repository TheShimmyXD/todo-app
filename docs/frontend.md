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
| `app/page.tsx` | Página principal: título y, dentro de `<Suspense>`, pestañas y lista. | Server |
| `components/StatusTabs.tsx` | Pestañas Todas / Pendientes / Completadas con contador. Son enlaces: no necesitan JavaScript en el navegador. | Server |
| `components/TaskList.tsx` | Lista de tareas del filtro actual y mensaje de lista vacía. | Server |
| `lib/prisma.ts` | Cliente de Prisma compartido (singleton en `globalThis` para el modo dev). | Solo servidor |
| `lib/tasks.ts` | Filtro de la URL (`parseStatusFilter`) y consultas: `listTasks`, `countTasks`. | Solo servidor |
| `lib/format.ts` | Fecha relativa en español («hace 5 minutos», «ayer»). | Ambos |
| `generated/prisma/` | Cliente de Prisma generado. **No se versiona ni se edita**: se regenera solo. | Solo servidor |
| `prisma.config.ts` | Le dice al CLI de Prisma dónde está el schema (`../backend/prisma/schema.prisma`). | — |
| `next.config.ts` | Carga el `.env` de la raíz del repositorio y activa Cache Components. | — |

`lib/prisma.ts` y `lib/tasks.ts` importan `server-only`: si un Client Component los importa por error, el build falla en lugar de mandar el cliente de la base al navegador.

**Server o Client:** todo es Server Component salvo lo que necesita estado o eventos del navegador (formulario, botones de completar y eliminar), que llevará `'use client'`. Así la lista llega como HTML ya armado y el JavaScript que descarga el navegador es mínimo.

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

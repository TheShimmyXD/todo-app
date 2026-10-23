# API REST (backend/)

La API está hecha con Express 5 y TypeScript. Es **la única parte del sistema que escribe en la base**: valida cada entrada y ejecuta SQL parametrizado con `pg`. El esquema no se toca desde aquí; lo define Prisma (ver [`database.md`](database.md)).

## Cómo correrla

```bash
docker compose up -d db          # la base tiene que estar arriba
cd backend
npm ci                           # dependencias (solo la primera vez o tras cambiar package-lock.json)
npm run db:deploy                # aplica las migraciones pendientes
npm run dev                      # API en http://localhost:4000, se reinicia al guardar
```

| Script | Qué hace |
|---|---|
| `npm run dev` | Corre `src/server.ts` con `tsx watch`: sin compilar y con recarga automática. |
| `npm run build` | Compila `src/` a `dist/` con `tsc` (`tsconfig.build.json`). |
| `npm start` | Corre la versión compilada (`node dist/server.js`). Es lo que usa producción. |
| `npm run lint` | ESLint con las reglas recomendadas de TypeScript (`eslint.config.js`). |
| `npm run typecheck` | Revisa los tipos de todo el paquete (código, pruebas y configuración) sin generar archivos. |
| `npm test` | Corre las pruebas una vez (ver [Pruebas](#pruebas)). `npm run test:watch` las repite al guardar. |
| `npm run db:migrate` / `db:deploy` / `db:status` | Migraciones de Prisma (ver [`database.md`](database.md)). |

Comprobación rápida: `curl localhost:4000/health` → `{"status":"ok"}`.

## Endpoints

Todas las respuestas son JSON. Una tarea tiene esta forma:

```json
{
  "id": "59231a78-c51f-4935-b140-96d103f6db04",
  "title": "Comprar pan",
  "description": "Integral",
  "completed": false,
  "createdAt": "2026-10-23T19:27:24.122Z"
}
```

| Método y ruta | Cuerpo | Respuesta |
|---|---|---|
| `GET /api/tasks` | — | `200` con la lista, de la más reciente a la más antigua. Filtro opcional: `?completed=true` o `?completed=false`. |
| `POST /api/tasks` | `{ "title", "description"? }` | `201` con la tarea creada (`completed` empieza en `false`). |
| `PUT /api/tasks/:id` | Cualquier combinación de `title`, `description`, `completed` (al menos uno) | `200` con la tarea actualizada. Los campos que no se envían no cambian. |
| `DELETE /api/tasks/:id` | — | `204` sin cuerpo. |
| `GET /health` | — | `200 {"status":"ok"}` si la base responde; `503` si no. Lo usa el healthcheck de Docker. |

Ejemplos:

```bash
curl -X POST localhost:4000/api/tasks -H 'Content-Type: application/json' \
     -d '{"title":"Comprar pan","description":"Integral"}'
curl localhost:4000/api/tasks?completed=false
curl -X PUT localhost:4000/api/tasks/<id> -H 'Content-Type: application/json' -d '{"completed":true}'
curl -X DELETE localhost:4000/api/tasks/<id>
```

### Reglas de validación

Están en `src/validation/tasks.ts` (esquemas de zod).

- `title`: texto obligatorio al crear; se le quitan los espacios de los extremos y no puede quedar vacío; máximo 200 caracteres (el mismo límite que la columna).
- `description`: texto opcional, máximo 2000 caracteres; si no se envía al crear, queda `""`.
- `completed`: booleano (`true`/`false`, no `"true"`). Solo se cambia con `PUT`.
- Los campos desconocidos se rechazan (por ejemplo, `{"title":"x","priority":1}` → 400): así un error de tipeo en el cliente no se pierde en silencio.
- `:id` tiene que ser un UUID; si no lo es, la respuesta es 400 (no 404).
- El cuerpo admite como máximo 10 kB.

## Formato de errores

Todos los errores salen con la misma forma, la produce un único middleware (`src/middleware/errors.ts`):

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request is not valid",
    "details": [{ "field": "title", "message": "Title cannot be empty" }]
  }
}
```

`details` solo aparece en los errores de validación. El cliente debe decidir con `code` (estable) y mostrar `message` como texto de apoyo.

| Estado | `code` | Cuándo |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Cuerpo, parámetro o filtro que no cumple las reglas. |
| 400 | `INVALID_JSON` | El cuerpo no es JSON válido. |
| 404 | `TASK_NOT_FOUND` | No existe una tarea con ese id. |
| 404 | `NOT_FOUND` | La ruta no existe. |
| 413 | `PAYLOAD_TOO_LARGE` | El cuerpo supera 10 kB. |
| 503 | `DATABASE_UNAVAILABLE` | `/health` no pudo consultar la base. |
| 500 | `INTERNAL_ERROR` | Cualquier error no previsto. El detalle completo va al log del servidor; al cliente nunca se le envía el stack. |

## Cómo está organizado `src/`

| Archivo | Responsabilidad |
|---|---|
| `server.ts` | Punto de entrada: escucha en `API_PORT` y cierra limpio ante `SIGTERM`/`SIGINT` (deja terminar las peticiones en curso y cierra el pool; si tarda más de 10 s, sale igual). |
| `app.ts` | Arma la aplicación de Express sin escuchar (las pruebas la usan directamente). Define el orden: parser de JSON, rutas, 404 y errores. |
| `config.ts` | Lee el `.env` de la raíz y valida las variables al arrancar; si falta una, el proceso termina con un mensaje claro. |
| `db/pool.ts` | El único pool de conexiones del proceso. |
| `db/tasks.ts` | Todo el SQL de la tabla `tasks`. Las rutas nunca escriben SQL. |
| `validation/tasks.ts` | Esquemas de entrada y la función `validate`, que convierte un fallo en un 400. |
| `routes/tasks.ts`, `routes/health.ts` | Los endpoints. Solo describen el camino feliz: los errores se lanzan. |
| `middleware/errors.ts` | `HttpError`, el 404 de rutas y el manejador de errores. |
| `types/task.ts` | Tipo `Task` que devuelve la API. |

### Cómo agregar un endpoint

Ejemplo: `PATCH /api/tasks/:id/toggle`, que invierte `completed`.

1. **SQL** en `src/db/tasks.ts`: una función nueva, con los valores como parámetros (`$1`), nunca concatenados. Si la consulta filtra u ordena por columnas nuevas, revisa el índice en [`database.md`](database.md).
2. **Validación** en `src/validation/tasks.ts`: un esquema con `z.strictObject` para el cuerpo o los parámetros (aquí basta `taskIdSchema`).
3. **Ruta** en `src/routes/tasks.ts` (o un archivo nuevo en `routes/`, montado en `app.ts`): `validate(...)`, llamar a la función de `db/`, responder. Para un caso de error, `throw new HttpError(status, "CODE", "message")`; no hace falta `try/catch`, Express 5 pasa al middleware las promesas rechazadas.
4. **Documentación**: la fila en la tabla de endpoints de este archivo y, si hay un código de error nuevo, en la tabla de errores.
5. **Pruebas** en `tests/`: el caso feliz y cada error nuevo (ver [Pruebas](#pruebas)).

## Pruebas

Vitest y supertest: cada prueba hace peticiones HTTP reales a la aplicación (`createApp()`, sin abrir un puerto) y esta consulta una base PostgreSQL real.

```bash
docker compose up -d db          # la base tiene que estar arriba
cd backend && npm test           # 31 pruebas en ~3 s
```

- **Base aparte.** Las pruebas usan `TEST_DATABASE_URL` (por defecto, la base `todo_test` en el mismo contenedor), nunca la de desarrollo. `vitest.config.ts` se niega a correr si las dos URL coinciden, porque cada prueba vacía la tabla.
- **Preparación automática.** `tests/global-setup.ts` crea la base de pruebas si no existe y le aplica las migraciones (`prisma migrate deploy`) antes de la primera prueba. No hay que hacer nada a mano, ni siquiera la primera vez.
- **Datos.** Cada prueba empieza con `TRUNCATE tasks` y crea lo que necesita. Por eso los archivos corren uno detrás de otro (`fileParallelism: false`).
- **Fallas de la base.** Los casos 500 y 503 se simulan haciendo que `pool.query` falle una vez (`vi.spyOn`), sin detener el contenedor.

| Archivo | Qué cubre |
|---|---|
| `tests/tasks.test.ts` | Los 4 endpoints de tareas: casos felices, cada regla de validación, orden, filtro, 404 por id inexistente, JSON roto y cuerpo demasiado grande. |
| `tests/app.test.ts` | `/health` (200 y 503), ruta inexistente (404), error inesperado (500 sin filtrar el detalle) y cabeceras. |

## Pool de conexiones

Un solo `pg.Pool` por proceso (`src/db/pool.ts`), configurado con variables de entorno:

| Variable | Por defecto | Para qué |
|---|---|---|
| `DB_POOL_MAX` | `10` | Conexiones abiertas como máximo. Deja margen en el `max_connections` de PostgreSQL (100) para Prisma y otros clientes. |
| `DB_POOL_IDLE_TIMEOUT_MS` | `30000` | Tiempo que una conexión sin uso sigue abierta antes de cerrarse. |
| `DB_POOL_CONNECTION_TIMEOUT_MS` | `5000` | Tiempo máximo para obtener una conexión. Si la base no responde, la petición falla en vez de quedar colgada. |

Una conexión inactiva que se cae (reinicio de la base, corte de red) se registra en el log y el pool la reemplaza en la siguiente consulta; el proceso no se cae.

## Scripts de instalación de dependencias

npm 11 no ejecuta los scripts de instalación de los paquetes salvo que estén aprobados en `allowScripts` de `package.json`:

- `prisma@7.10.1` y `@prisma/engines@7.10.1`: **aprobados**. Comprueban la versión de Node y preparan los motores de Prisma; sin ellos las migraciones no funcionan.
- `esbuild` (lo trae `tsx`): **denegado**. Su script solo verifica el binario, que ya llega como paquete opcional de la plataforma; `npm run dev` funciona sin él.

Si al instalar una dependencia nueva npm avisa de scripts sin revisar, revisa qué hacen (`npm install-scripts ls`) y apruébalos o deniégalos con `npm install-scripts approve|deny <paquete>`.

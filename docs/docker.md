# Docker

Toda la aplicación se levanta con un solo comando desde la raíz del repositorio:

```bash
docker compose up --build -d    # base, migraciones, API y web
docker compose ps -a            # db y backend (healthy), frontend Up, migrate Exited (0)
```

- Web: http://localhost:3000
- API: http://localhost:4000 (`curl localhost:4000/health` → `{"status":"ok"}`)
- PostgreSQL: `localhost:5432`

No hace falta crear `.env`: cada variable tiene un valor por defecto en `docker-compose.yml`. Para cambiar puertos o credenciales, `cp .env.example .env` y edita los valores.

## Servicios y orden de arranque

```
db (healthy) ──► migrate (termina con 0) ──► backend (healthy) ──► frontend
```

| Servicio | Imagen | Qué hace | Cuándo está listo |
|---|---|---|---|
| `db` | `postgres:18.6-alpine` | Base de datos, con los datos en el volumen `db-data`. | `pg_isready` responde. |
| `migrate` | `backend/Dockerfile`, etapa `migrate` | Corre `prisma migrate deploy` (aplica las migraciones pendientes) y termina. | Sale con código 0. |
| `backend` | `backend/Dockerfile`, etapa `runtime` | API Express (`node dist/server.js`). | `GET /health` responde 200, es decir, la API llega a la base. |
| `frontend` | `frontend/Dockerfile`, etapa `runtime` | Next.js en modo `standalone` (`node server.js`). | — |

Cada servicio espera al anterior con `depends_on` y una condición (`service_healthy` o `service_completed_successfully`). Así la API nunca arranca contra una base sin migrar y la web nunca reenvía escrituras a una API que no existe.

`migrate` solo **aplica** migraciones ya versionadas en `backend/prisma/migrations/`. Las migraciones nuevas se crean en desarrollo con `npm run db:migrate -- --name <cambio>` dentro de `backend/` (ver [`database.md`](database.md)) y se suben con el código; el siguiente `docker compose up` las aplica.

## Las imágenes

Las dos usan `node:24.22.1-trixie-slim` (Debian, no Alpine: el motor de esquema de Prisma espera glibc y OpenSSL) y construcción en varias etapas, para que la imagen final lleve solo lo que necesita para correr. Las dos corren con el usuario `node`, no como root.

**Backend** (`backend/Dockerfile`, contexto `backend/`):

| Etapa | Contenido |
|---|---|
| `deps` | `npm ci` con todas las dependencias. |
| `build` | Compila `src/` a `dist/` con `tsc`. |
| `prod-deps` | `npm ci --omit=dev`: solo Express, pg, zod y dotenv. |
| `runtime` | `dist/` + dependencias de producción (~245 MB). |
| `migrate` | `deps` + `prisma/` + `prisma.config.ts` + OpenSSL; es la última etapa para que construir `runtime` no la arrastre. |

**Frontend** (`frontend/Dockerfile`, contexto la **raíz** del repositorio): el cliente de Prisma se genera desde `backend/prisma/schema.prisma`, así que la imagen necesita ver las dos carpetas. El schema se copia a la misma ruta relativa que en el repositorio para que el `output` del generator (`../../frontend/generated/prisma`) caiga dentro del paquete. `next build` (con `NEXT_OUTPUT=standalone`, que `next.config.ts` traduce a `output: "standalone"` solo dentro de la imagen, porque `next start` no admite ese modo) deja en `.next/standalone` un `server.js` mínimo y solo los archivos que usa; la imagen copia eso más `.next/static` (~280 MB).

El build no necesita la base ni `DATABASE_URL`: el cliente de Prisma se crea en la primera consulta (`getPrisma()` en `frontend/lib/prisma.ts`), no al importar el módulo.

Qué queda fuera de cada contexto de build: `backend/.dockerignore` y `.dockerignore` de la raíz (dependencias, compilados, cliente generado, `.env` y el historial de Git). Ningún `.env` entra en una imagen; las variables llegan en tiempo de ejecución desde `docker-compose.yml`.

## Variables

Dentro de la red de Compose los servicios se llaman por su nombre, no por `localhost`. Por eso `docker-compose.yml` arma su propia `DATABASE_URL` (`postgresql://<usuario>:<contraseña>@db:5432/<base>`) con las mismas `POSTGRES_*` del servicio `db`, y le da a Next `BACKEND_URL=http://backend:4000`. Las `DATABASE_URL` y `BACKEND_URL` de `.env` son para correr los paquetes fuera de Docker y Compose las ignora.

| Variable en `.env` | Por defecto | Efecto en Compose |
|---|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | `todo` | Credenciales de la base y de la `DATABASE_URL` de los contenedores. Como van dentro de una URL, no pueden llevar `@`, `:`, `/` ni `#`. |
| `POSTGRES_PORT` | `5432` | Puerto de la máquina para PostgreSQL. |
| `API_PORT` | `4000` | Puerto de la máquina para la API (dentro del contenedor siempre es 4000). |
| `FRONTEND_PORT` | `3000` | Puerto de la máquina para la web. |
| `DB_POOL_*` | `10`, `30000`, `5000` | Pool de conexiones de Express (ver [`api.md`](api.md#pool-de-conexiones)). |

Cambiar credenciales después del primer arranque no cambia una base ya creada: PostgreSQL solo las lee cuando el volumen está vacío. Para empezar de cero, `docker compose down -v`.

## Comandos útiles

```bash
docker compose up -d db                 # solo la base, para desarrollar fuera de Docker
docker compose up --build -d backend    # reconstruye y reinicia solo la API (y lo que necesita)
docker compose logs -f backend          # logs de un servicio
docker compose logs migrate             # qué migraciones se aplicaron
docker compose exec db psql -U todo -d todo
docker compose stop                     # detiene todo; los datos se conservan
docker compose down -v                  # borra contenedores y volumen: la base queda vacía
```

`docker stop` envía SIGTERM: la API deja de aceptar peticiones, termina las que tiene en curso y cierra el pool (en el log: `Server and database pool closed`).

## Cómo agregar un servicio

1. Si es código propio, un `Dockerfile` en su carpeta con etapas `build` y `runtime`, imagen `slim` fijada a una versión exacta, usuario sin privilegios y su `.dockerignore`.
2. El servicio en `docker-compose.yml` con `build`, sus variables (con valor por defecto si es configurable), `depends_on` con condición y, si otros dependen de él, un `healthcheck`.
3. Su fila en la tabla de servicios de este archivo y, si usa variables nuevas, en `.env.example` y en el README.

## Problemas comunes

- **`port is already allocated`**: otro proceso usa 3000, 4000 o 5432 (por ejemplo, un `npm run dev` que quedó abierto). Detenlo o cambia `FRONTEND_PORT`, `API_PORT` o `POSTGRES_PORT` en `.env`. Para ver quién lo usa: `ss -ltnp | grep -E ':3000 |:4000 |:5432 '`.
- **`migrate` sale con un código distinto de 0**: `docker compose logs migrate` muestra el error de Prisma; `backend` y `frontend` no arrancan hasta que se corrija.
- **La web muestra «No se pudieron cargar las tareas»**: la base no responde; revisa `docker compose ps -a`.
- **Crear o editar responde 502 `BACKEND_UNAVAILABLE`**: la API no está arriba; `docker compose logs backend`.
- **Los cambios en el código no aparecen**: las imágenes se construyen con `--build`; sin ese flag, Compose reutiliza la imagen anterior.

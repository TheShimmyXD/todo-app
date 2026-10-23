# To-Do App

Aplicación de tareas para un equipo: crear, listar, filtrar (todas, completadas y pendientes), editar, marcar como completada y eliminar tareas. El backend es una API REST en Express y TypeScript sobre PostgreSQL; el frontend es una aplicación Next.js con Prisma; todo se levanta con Docker Compose.

> Estado: en construcción. Las secciones marcadas como *pendiente* se completan a medida que se agrega cada parte.

## Tecnologías utilizadas

| Capa | Tecnología | Versión |
|---|---|---|
| Entorno | Node.js (LTS) | 24.x |
| Lenguaje | TypeScript | 5.9.3 |
| Backend | Express | 5.3.0 |
| Acceso a datos (escrituras) | node-postgres (`pg`) | 8.23.1 |
| Validación | Zod | 4.6.7 |
| Esquema, migraciones y lecturas | Prisma ORM (`prisma`, `@prisma/client`, `@prisma/adapter-pg`) | 7.10.1 |
| Frontend | Next.js (App Router) + React | 16.4.3 + 19.3.0 |
| Estilos | Tailwind CSS | 4.3.3 |
| Pruebas | Vitest + Supertest | 5.0.5 + 7.3.1 |
| Calidad | ESLint + typescript-eslint | 9.39.5 + 8.72.0 |
| Base de datos | PostgreSQL (imagen `postgres:18.6-alpine`) | 18.6 |
| Contenedores | Docker + Docker Compose | 29.x + 2.40 |

Las versiones están fijadas sin rangos (`^`) para que todo el equipo instale exactamente lo mismo. TypeScript se mantiene en la línea 5.9 porque typescript-eslint todavía no admite TypeScript 7, y Prisma se mantiene en la última versión estable (7.10.1), no en la candidata 8.

## Arquitectura

*Pendiente.* Resumen del diseño: Prisma es el dueño del esquema y de las migraciones; Express es el único que escribe en la base y valida los datos; Next.js lee con Prisma desde sus Server Components y envía las escrituras a Express a través de sus Route Handlers.

## Estructura del repositorio

| Ruta | Contenido |
|---|---|
| `backend/` | API REST con Express (`src/`) y dueño del esquema (`prisma/schema.prisma`, `prisma/migrations/`, `prisma.config.ts`). |
| `db/queries.sql` | Consultas SQL escritas a mano: tareas por estado y conteo por estado. |
| `docs/` | Documentación para el equipo. `database.md`: tabla, índice, migraciones. `api.md`: endpoints, errores, cómo agregar un endpoint. |
| `docker-compose.yml` | Servicios de Docker. Por ahora, solo `db` (PostgreSQL con volumen persistente y healthcheck). |
| `.env.example` | Plantilla de todas las variables de entorno (ver más abajo). |
| `.editorconfig` | Codificación, finales de línea e indentación comunes para cualquier editor. |
| `.gitignore` | Dependencias, salidas de compilación y archivos `.env` locales que nunca se versionan. |

## Variables de entorno

Copia la plantilla y ajusta los valores: `cp .env.example .env`. El archivo `.env` está en `.gitignore`; solo se versiona `.env.example`.

| Variable | Quién la usa | Para qué |
|---|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Contenedor de PostgreSQL | Usuario, contraseña y base que se crean al iniciar el contenedor. |
| `POSTGRES_PORT` | Docker Compose | Puerto de la máquina donde se publica PostgreSQL. |
| `DATABASE_URL` | Prisma y el pool de Express | Cadena de conexión a la base. |
| `API_PORT` | Express | Puerto en el que escucha la API. |
| `DB_POOL_MAX`, `DB_POOL_IDLE_TIMEOUT_MS`, `DB_POOL_CONNECTION_TIMEOUT_MS` | Pool de Express | Tamaño y tiempos de espera del pool (opcionales; valores por defecto en [`docs/api.md`](docs/api.md#pool-de-conexiones)). |
| `BACKEND_URL` | Route Handlers de Next.js | URL base de la API a la que se reenvían las escrituras. Solo existe en el servidor. |

## Instalación

*Pendiente.*

## Comandos para correr el proyecto

### Base de datos (PostgreSQL en Docker)

```bash
cp .env.example .env            # solo la primera vez
docker compose up -d db         # levanta PostgreSQL 18.6
docker compose ps               # el servicio db debe decir (healthy)
docker compose exec db psql -U todo -d todo   # consola SQL (usuario y base de .env)
docker compose stop db          # detiene el contenedor; los datos se conservan
docker compose down -v          # borra el contenedor y el volumen: la base queda vacía
```

- Los datos viven en el volumen `todo-app_db-data`, montado en `/var/lib/postgresql`. Desde PostgreSQL 18 la imagen oficial guarda los datos en un subdirectorio por versión mayor, por eso el volumen se monta en esa carpeta y no en `/var/lib/postgresql/data` como en versiones anteriores.
- El healthcheck usa `pg_isready` contra la base de la aplicación; los servicios que dependan de la base esperan a que esté `healthy`.
- Si falta una variable obligatoria en `.env`, `docker compose` se detiene con un mensaje como `required variable POSTGRES_DB is missing a value`.
- Si el puerto 5432 ya está ocupado en tu máquina, cambia `POSTGRES_PORT` en `.env` (y el puerto de `DATABASE_URL`).

### API (Express)

```bash
cd backend
npm ci && npm run db:deploy     # solo la primera vez
npm run dev                     # http://localhost:4000, recarga al guardar
curl localhost:4000/health      # {"status":"ok"}
```

Endpoints, reglas de validación, formato de errores y cómo agregar un endpoint: [`docs/api.md`](docs/api.md).

## Decisiones técnicas tomadas

*Pendiente.*

## Base de datos

Una sola tabla, `tasks`, definida en `backend/prisma/schema.prisma` y creada por la migración inicial de Prisma. Tiene un índice compuesto sobre `(completed, created_at DESC)`: sirve al filtro por estado y entrega las tareas ya ordenadas de la más reciente a la más antigua.

Para crear la tabla en una base vacía:

```bash
docker compose up -d db
cd backend && npm ci && npm run db:deploy
```

El detalle de columnas, la justificación del índice con `EXPLAIN ANALYZE` y cómo crear nuevas migraciones y cómo correr `db/queries.sql` están en [`docs/database.md`](docs/database.md).

## Despliegue en Ubuntu desde cero

*Pendiente.*

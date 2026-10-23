# To-Do App

Aplicación de tareas para un equipo: crear, listar, filtrar (todas, completadas y pendientes), editar, marcar como completada y eliminar tareas. El backend es una API REST en Express y TypeScript sobre PostgreSQL; el frontend es una aplicación Next.js con Prisma; todo se levanta con Docker Compose.

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

```mermaid
flowchart LR
    U[Navegador] -->|páginas| N[Next.js :3000]
    U -->|"POST, PUT, DELETE /api/tasks"| N
    N -->|"lecturas (Server Components + Prisma Client)"| DB[(PostgreSQL)]
    N -->|"Route Handlers reenvían las escrituras"| E[Express :4000]
    E -->|"SQL parametrizado (pg Pool)"| DB
    M["migrate (prisma migrate deploy)"] -->|esquema| DB
```

- **Prisma es el dueño del esquema.** La tabla se define una sola vez, en `backend/prisma/schema.prisma`, y solo cambia con una migración de Prisma.
- **Express es el único que escribe.** Valida cada petición y escribe con SQL parametrizado sobre un pool de `pg`.
- **Next.js lee con Prisma y escribe a través de Express.** Las páginas son Server Components que consultan con el cliente de Prisma (generado desde el mismo schema). Los formularios y botones son Client Components que llaman a los Route Handlers de Next (`/api/tasks`), y estos reenvían la petición a Express sin cambiar su respuesta.
- Al terminar una escritura, la interfaz pide a Next que vuelva a renderizar la página (`router.refresh()`), y la lista se lee otra vez de la base.

Vista de conjunto, flujos de lectura y escritura y dónde vive cada responsabilidad: [`docs/architecture.md`](docs/architecture.md). Detalle por capa: [`docs/database.md`](docs/database.md), [`docs/api.md`](docs/api.md), [`docs/frontend.md`](docs/frontend.md) y [`docs/docker.md`](docs/docker.md).

## Estructura del repositorio

| Ruta | Contenido |
|---|---|
| `backend/` | API REST con Express (`src/`), sus pruebas (`tests/`) y dueño del esquema (`prisma/schema.prisma`, `prisma/migrations/`, `prisma.config.ts`). |
| `frontend/` | Interfaz web con Next.js: páginas (`app/`), componentes (`components/`), lectura con Prisma (`lib/`). El cliente de Prisma se genera en `generated/` desde el schema del backend. |
| `db/queries.sql` | Consultas SQL escritas a mano: tareas por estado y conteo por estado. |
| `CONTRIBUTING.md` | Cómo trabajar en equipo: entorno, ramas, commits, qué correr antes de un PR y qué revisar en uno. |
| `docs/` | Documentación para el equipo. `architecture.md`: componentes, flujos y dónde vive cada responsabilidad. `adding-a-field.md`: cómo agregar un campo de punta a punta. `adr/`: decisiones de arquitectura. `windows.md`: instalación y desarrollo en Windows 11 con PowerShell. `database.md`: tabla, índice, migraciones. `api.md`: endpoints, errores, cómo agregar un endpoint. `frontend.md`: estructura de Next, Server y Client Components, cómo agregar un filtro. `docker.md`: imágenes, orden de arranque, variables y problemas comunes. |
| `docker-compose.yml` | Toda la aplicación: `db` (PostgreSQL con volumen y healthcheck), `migrate` (aplica las migraciones), `backend` y `frontend`. |
| `backend/Dockerfile`, `frontend/Dockerfile` | Imágenes de la API y de la web, en varias etapas (ver [`docs/docker.md`](docs/docker.md)). |
| `.dockerignore`, `backend/.dockerignore` | Lo que queda fuera de cada contexto de build (dependencias, compilados, `.env`). |
| `.env.example` | Plantilla de todas las variables de entorno (ver más abajo). |
| `.editorconfig` | Codificación, finales de línea e indentación comunes para cualquier editor. |
| `.gitattributes` | Finales de línea LF en el repositorio y en cada checkout, también en Windows. |
| `.gitignore` | Dependencias, salidas de compilación y archivos `.env` locales que nunca se versionan. |

## Variables de entorno

Copia la plantilla y ajusta los valores: `cp .env.example .env`. El archivo `.env` está en `.gitignore`; solo se versiona `.env.example`.

Para levantar todo con Docker no hace falta `.env`: `docker-compose.yml` trae un valor por defecto para cada variable y arma sus propias URLs internas (ver [`docs/docker.md`](docs/docker.md#variables)). `.env` hace falta para correr la API o la web fuera de Docker.

| Variable | Quién la usa | Para qué |
|---|---|---|
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Contenedor de PostgreSQL | Usuario, contraseña y base que se crean al iniciar el contenedor. |
| `POSTGRES_PORT` | Docker Compose | Puerto de la máquina donde se publica PostgreSQL. |
| `FRONTEND_PORT` | Docker Compose | Puerto de la máquina donde se publica la web (por defecto 3000). |
| `DATABASE_URL` | Prisma y el pool de Express | Cadena de conexión a la base. |
| `TEST_DATABASE_URL` | Pruebas del backend | Base aparte que usan las pruebas (`todo_test`); se crea sola y debe ser distinta de `DATABASE_URL`. |
| `API_PORT` | Express | Puerto en el que escucha la API. |
| `DB_POOL_MAX`, `DB_POOL_IDLE_TIMEOUT_MS`, `DB_POOL_CONNECTION_TIMEOUT_MS` | Pool de Express | Tamaño y tiempos de espera del pool (opcionales; valores por defecto en [`docs/api.md`](docs/api.md#pool-de-conexiones)). |
| `BACKEND_URL` | Route Handlers de Next.js | URL base de la API a la que se reenvían las escrituras. Solo existe en el servidor. |

## Instalación

Requisitos:

- Para levantar todo: Git, Docker y Docker Compose v2 (`docker compose version`).
- Para desarrollar fuera de Docker: además, Node.js 24 LTS. Con [nvm](https://github.com/nvm-sh/nvm): `nvm install 24 && nvm use 24`.
- En Windows 11: Docker Desktop y PowerShell; las órdenes equivalentes están en [`docs/windows.md`](docs/windows.md).

```bash
git clone <url-del-repositorio> todo-app
cd todo-app
docker compose up --build -d    # listo en http://localhost:3000
```

Para desarrollar con recarga en caliente, en cambio:

```bash
cp .env.example .env            # variables para correr fuera de Docker
docker compose up -d db         # solo PostgreSQL
cd backend && npm ci && npm run db:deploy && cd ..   # dependencias y tabla
cd frontend && npm ci && cd ..
```

Después, `npm run dev` en `backend/` y en `frontend/` (ver la sección siguiente). Cada paquete tiene sus propias dependencias (`npm ci` en cada carpeta); no hay workspaces.

## Comandos para correr el proyecto

### Todo con Docker

```bash
docker compose up --build -d    # base, migraciones, API y web
docker compose ps -a            # db y backend (healthy), frontend Up, migrate Exited (0)
```

Web en http://localhost:3000 y API en http://localhost:4000. Servicios, imágenes, variables y problemas comunes: [`docs/docker.md`](docs/docker.md).

Para desarrollar, lo habitual es levantar solo la base en Docker y correr la API y la web con `npm run dev` (secciones siguientes).

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
- Si el puerto 5432 ya está ocupado en tu máquina, cambia `POSTGRES_PORT` en `.env` (y el puerto de `DATABASE_URL`).

### API (Express)

```bash
cd backend
npm ci && npm run db:deploy     # solo la primera vez
npm run dev                     # http://localhost:4000, recarga al guardar
curl localhost:4000/health      # {"status":"ok"}
npm test                        # pruebas contra la base todo_test
```

Endpoints, reglas de validación, formato de errores y cómo agregar un endpoint: [`docs/api.md`](docs/api.md).

### Interfaz web (Next.js)

```bash
cd frontend
npm ci                          # solo la primera vez
npm run dev                     # http://localhost:3000 (con la base levantada)
npm run build && npm start      # versión de producción
```

Estructura, qué es Server y qué es Client, y cómo agregar un filtro: [`docs/frontend.md`](docs/frontend.md).

## Decisiones técnicas tomadas

### Quién toca la base de datos

El enunciado pide a la vez un backend Express sobre PostgreSQL, Prisma configurado en el proyecto Next.js y API Routes de Next que se conecten con Express. Tomado al pie de la letra, eso abre dos caminos hacia la base: si Next escribiera con Prisma y Express con SQL, habría dos lugares que validan los datos, y si cada uno tuviera su schema, dos fuentes de verdad que se desincronizan con la primera migración.

Se resolvió con **un solo schema y un solo camino de escritura**:

- El schema y las migraciones viven en `backend/prisma/` (por eso el commit «Backend setup con Express y Prisma»).
- Next.js usa Prisma solo para **leer**: genera su cliente desde ese mismo schema y lo usa en los Server Components.
- Toda **escritura** pasa por Express: los Route Handlers de Next la reenvían y devuelven la respuesta de Express tal cual, así que las reglas de validación y los códigos de error existen en un solo lugar.

La consecuencia práctica: agregar un campo es un recorrido fijo (schema → migración → SQL de Express → validación → interfaz) y nunca hay que sincronizar dos modelos ([`docs/adding-a-field.md`](docs/adding-a-field.md)). La decisión completa, con las opciones descartadas, está en [`docs/adr/0001-data-ownership.md`](docs/adr/0001-data-ownership.md).

### API

- **Validación con Zod** (`backend/src/validation/`): esquemas estrictos, así que un campo desconocido es un 400 con su nombre en vez de ignorarse en silencio. El título se recorta, no puede quedar vacío y tiene el mismo límite que su columna (200 caracteres); la descripción admite hasta 2000.
- **Un formato de error único**: `{ "error": { "code", "message", "details"? } }`, producido por un solo middleware. La interfaz decide con `code`, que es estable, y nunca recibe un stack.
- **`PUT` parcial**: el enunciado nombra `PUT /api/tasks/:id`, y la interfaz necesita marcar una tarea como completada sin reenviar título y descripción. Por eso `PUT` acepta cualquier combinación de campos (al menos uno) y no cambia los que no recibe, con un único `UPDATE` parametrizado. En REST estricto eso sería `PATCH`; se mantuvo el método del enunciado.
- **SQL a mano y fijo**: cada operación es una sentencia parametrizada (nada de SQL armado con texto), fácil de revisar y de comparar con `db/queries.sql`.
- **Pool de conexiones** configurable (`DB_POOL_*`): máximo de 10 conexiones, para dejar margen a Prisma en el límite de 100 de PostgreSQL, y tiempo de espera de 5 s para que una base caída produzca un error en vez de una petición colgada.
- **Falla temprano**: el entorno se valida al arrancar, y la API se apaga limpia al recibir SIGTERM (termina las peticiones en curso y cierra el pool).

### Interfaz

- **Server Components para leer, Client Components para interactuar**: la lista y los contadores se renderizan en el servidor; el formulario, los botones y los mensajes de error son los únicos componentes que corren en el navegador.
- **El filtro vive en la URL** (`?completed=true`), igual que en la API: se puede compartir, recargar y volver atrás.
- Si Express no responde, los Route Handlers contestan `502 BACKEND_UNAVAILABLE` o `504 BACKEND_TIMEOUT` con el mismo formato de error, y la interfaz lo muestra como cualquier otro.

### Entorno y Docker

- **Versiones exactas**, sin `^`, para que todo el equipo instale lo mismo (tabla de tecnologías).
- **Un solo `.env`** en la raíz para los dos paquetes; Docker no lo necesita, porque `docker-compose.yml` trae valores por defecto.
- **Imágenes en varias etapas** sobre `node:24-slim` (Debian), con un servicio `migrate` que aplica las migraciones antes de que arranque la API ([`docs/docker.md`](docs/docker.md)).

## Base de datos

Una sola tabla, `tasks`, definida en `backend/prisma/schema.prisma` y creada por la migración inicial de Prisma (`backend/prisma/migrations/20261023192118_init/migration.sql`): `id` UUID como llave primaria, `title`, `description`, `completed` y `created_at`.

### Por qué el índice sobre `completed`

La consulta que más se repite es «tareas de un estado, de la más reciente a la más antigua» (`WHERE completed = $1 ORDER BY created_at DESC`), que usan el filtro de la API y las pestañas de la interfaz. Por eso el índice es **compuesto: `(completed, created_at DESC)`**.

- Un índice solo sobre `completed` aporta poco: una columna booleana tiene dos valores, así que cada uno abarca una gran parte de la tabla y PostgreSQL suele preferir leerla entera.
- Con `created_at DESC` como segunda columna, el índice además entrega las filas de cada estado ya ordenadas, y la base se ahorra el ordenamiento.
- Medido con `EXPLAIN ANALYZE` sobre 20 000 tareas (80 % completadas): las pendientes pasan de un recorrido completo de la tabla (3,8 ms) a un recorrido del índice (2,0 ms), y las completadas se leen del índice sin paso de ordenamiento. Con este volumen la diferencia es de milisegundos; lo que importa es la forma del plan, que se mantiene cuando la tabla crece.
- La vista «todas» (sin filtro) no aprovecha este índice; si llegara a ser lenta, la solución sería un índice aparte sobre `created_at DESC` o paginar.

Las dos consultas escritas a mano que pide el enunciado (tareas por estado y conteo agrupado por estado) están en `db/queries.sql`.

Para crear la tabla en una base vacía:

```bash
docker compose up -d db
cd backend && npm ci && npm run db:deploy
```

El detalle de columnas, la justificación del índice con `EXPLAIN ANALYZE` y cómo crear nuevas migraciones y cómo correr `db/queries.sql` están en [`docs/database.md`](docs/database.md).

## Despliegue en Ubuntu desde cero

Dos caminos para un servidor Ubuntu 24.04 recién instalado. Los comandos se comprobaron en un contenedor `ubuntu:24.04` limpio, salvo los marcados como *no comprobado*.

### Opción A: con Docker (un solo comando)

```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
sudo usermod -aG docker "$USER"      # cierra la sesión y vuelve a entrar
git clone <url-del-repositorio> todo-app && cd todo-app
docker compose up --build -d          # web en el puerto 3000, API en el 4000
```

*No comprobado en el contenedor* (Docker dentro de Docker); es el mismo `docker compose up` que se probó en desarrollo desde un clon limpio.

### Opción B: Node y PostgreSQL instalados en el servidor

```bash
# 1. Paquetes base
sudo apt update && sudo apt install -y curl git ca-certificates

# 2. Node.js 24 LTS (repositorio de NodeSource)
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
sudo apt install -y nodejs
node -v                               # v24.x

# 3. PostgreSQL 18 (repositorio oficial de PostgreSQL)
sudo apt install -y postgresql-common
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
sudo apt install -y postgresql-18
sudo -u postgres psql -c "CREATE USER todo WITH PASSWORD 'cambia-esta-clave';"
sudo -u postgres psql -c "CREATE DATABASE todo OWNER todo;"

# 4. Código y variables de entorno
git clone <url-del-repositorio> todo-app && cd todo-app
cp .env.example .env
# En .env, ajusta como mínimo:
#   DATABASE_URL=postgresql://todo:cambia-esta-clave@localhost:5432/todo
#   BACKEND_URL=http://localhost:4000

# 5. Tabla, compilación y arranque
cd backend && npm ci && npm run db:deploy && npm run build && cd ..
cd frontend && npm ci && npm run build && cd ..
(cd backend && npm start) &           # API en el puerto 4000
(cd frontend && npm start) &          # web en el puerto 3000
curl localhost:4000/health            # {"status":"ok"}
```

`npm ci` instala también las dependencias de desarrollo, que hacen falta para compilar (TypeScript, la CLI de Prisma).

Para que los dos procesos sigan corriendo al cerrar la sesión y arranquen con el servidor, un servicio de systemd por proceso (*no comprobado*: el contenedor de prueba no tiene systemd). Ejemplo para la API, con el repositorio en `/opt/todo-app` y el usuario `todo`:

```ini
# /etc/systemd/system/todo-api.service
[Unit]
Description=To-Do App API
After=network.target postgresql.service

[Service]
User=todo
WorkingDirectory=/opt/todo-app/backend
ExecStart=/usr/bin/npm start
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

El de la web es igual, con `WorkingDirectory=/opt/todo-app/frontend`, `Description=To-Do App web` y `After=todo-api.service`. Después: `sudo systemctl daemon-reload && sudo systemctl enable --now todo-api todo-web`. Los dos procesos leen el `.env` de la raíz del repositorio, así que no hace falta repetir las variables en el servicio.

## Windows 11

Con Docker Desktop, el mismo comando de siempre levanta todo desde PowerShell:

```powershell
git clone <url-del-repositorio> todo-app
cd todo-app
docker compose up --build -d    # web en http://localhost:3000
```

Para desarrollar con Node instalado en Windows, las órdenes en PowerShell, la política de ejecución de scripts y los problemas comunes (puertos reservados, máquinas virtuales): [`docs/windows.md`](docs/windows.md). *Pendiente de comprobar en Windows 11.*

# Requisitos y cómo comprobarlos

Cada requisito del enunciado de la prueba, dónde está resuelto y una orden que lo comprueba. Sirve para revisar la entrega y, después, para que un cambio no rompa algo que se pidió: si tocas una de estas piezas, vuelve a correr su comprobación.

Las órdenes suponen la pila levantada desde la raíz del repositorio con `docker compose up --build -d` (web en :3000, API en :4000, PostgreSQL en :5432). En Windows, las equivalentes en PowerShell están en [`windows.md`](windows.md).

## 1. Backend con Node.js + Express

| Requisito | Dónde | Cómo comprobarlo |
|---|---|---|
| `GET /api/tasks` lista las tareas | `backend/src/routes/tasks.ts` | `curl localhost:4000/api/tasks` → `200` con un arreglo. |
| `POST /api/tasks` crea una tarea | ídem | `curl -X POST localhost:4000/api/tasks -H 'Content-Type: application/json' -d '{"title":"Comprar pan"}'` → `201` con `id`, `title`, `description`, `completed` y `createdAt`. |
| `PUT /api/tasks/:id` actualiza | ídem | `curl -X PUT localhost:4000/api/tasks/<id> -H 'Content-Type: application/json' -d '{"completed":true}'` → `200`; con un id que no existe, `404`. |
| `DELETE /api/tasks/:id` elimina | ídem | `curl -X DELETE localhost:4000/api/tasks/<id>` → `204`; repetido, `404`. |
| Estructura de `Task` | `backend/src/types/task.ts`, `backend/src/db/tasks.ts` | La respuesta del `POST` trae los cinco campos; `id` es un UUID en texto. |
| Express | `backend/src/app.ts` | `backend/package.json` (`express` 5). |
| Conexión a PostgreSQL | `backend/src/db/pool.ts` | `curl localhost:4000/health` → `200 {"status":"ok"}` (consulta la base). |
| Middleware de manejo de errores | `backend/src/middleware/errors.ts` | `curl localhost:4000/api/nada` → `404` con `{"error":{...}}`; un JSON mal formado → `400` con el mismo formato ([`api.md`](api.md#formato-de-errores)). |
| Validación básica | `backend/src/validation/tasks.ts` | `-d '{"title":""}'` → `400`; un id que no es UUID → `400` ([reglas](api.md#reglas-de-validación)). |
| Pool de conexiones configurado | `backend/src/db/pool.ts`, variables `DB_POOL_*` | [`api.md`](api.md#pool-de-conexiones); las pruebas de `backend/tests/` lo usan contra una base real (`npm test` en `backend/`). |

## 2. Frontend con Next.js

| Requisito | Dónde | Cómo comprobarlo |
|---|---|---|
| Lista de tareas en `/` | `frontend/app/page.tsx`, `frontend/components/TaskList.tsx` | Crear una tarea con `curl` y abrir http://localhost:3000: aparece. |
| Formulario para crear | `frontend/components/NewTaskForm.tsx` | En el navegador: escribir un título y enviar. |
| Marcar como completada y eliminar | `frontend/components/TaskItem.tsx` | En el navegador: casilla y botón de eliminar de cada tarea. |
| Filtros Todas / Completadas / Pendientes | `frontend/components/StatusTabs.tsx` | http://localhost:3000/?completed=true y `?completed=false`: cada pestaña muestra solo su estado ([`frontend.md`](frontend.md#filtros)). |
| Next.js 15+ | `frontend/package.json` | `next` 16; `docker compose exec frontend node -e "console.log(require('next/package.json').version)"`. |
| Prisma para los datos en el servidor | `frontend/lib/prisma.ts`, `frontend/lib/tasks.ts`, `frontend/prisma.config.ts` | La página lee las tareas con Prisma desde un Server Component; el cliente se genera del mismo `schema.prisma` del backend ([`frontend.md`](frontend.md#el-cliente-de-prisma)). |
| Server y Client Components | `frontend/app/page.tsx` (Server); `NewTaskForm`, `TaskItem` y `app/error.tsx` (Client, con `"use client"`) | `grep -rl '"use client"' frontend/app frontend/components`. Por qué cada uno está donde está: [`frontend.md`](frontend.md#estructura). |
| API Routes hacia Express | `frontend/app/api/tasks/route.ts`, `frontend/app/api/tasks/[id]/route.ts` | Son los Route Handlers del App Router (el equivalente actual de las API Routes): `curl localhost:3000/api/tasks` devuelve lo mismo que `:4000/api/tasks`, y lo mismo con `POST`, `PUT` y `DELETE`. |
| Diseño responsive | Tailwind CSS 4 (`frontend/app/globals.css`) | Herramientas de desarrollo del navegador, vista de móvil. |

Prisma está en el proyecto Next.js, pero solo para leer; todas las escrituras pasan por Express. El porqué está en la [decisión de arquitectura 0001](adr/0001-data-ownership.md).

## 3. Git y GitHub

| Requisito | Cómo comprobarlo |
|---|---|
| Repositorio Git con commits significativos | `git log --oneline` |
| Los cinco commits mínimos | `git log --format=%s \| grep -x -E 'Initial commit\|Backend setup con Express y Prisma\|Frontend setup con Next.js\|Integración frontend-backend\|Final touches'` → cinco líneas. |
| README con instalación, comandos, tecnologías y decisiones | [`README.md`](../README.md): secciones *Instalación*, *Comandos para correr el proyecto*, *Tecnologías utilizadas* y *Decisiones técnicas tomadas*. |

## 4. Base de datos PostgreSQL

| Requisito | Dónde | Cómo comprobarlo |
|---|---|---|
| Schema con al menos una migración documentada | `backend/prisma/schema.prisma`, `backend/prisma/migrations/` | `docker compose exec db psql -U todo -d todo -c 'select migration_name, finished_at from _prisma_migrations'` ([`database.md`](database.md#migraciones)). |
| Tabla `tasks` con tipos correctos y llave primaria | migración `*_init` | `docker compose exec db psql -U todo -d todo -c '\d tasks'`: `id uuid` como llave primaria, `title varchar(200)`, `description text`, `completed boolean`, `created_at timestamptz`, todas `not null`. |
| Dos consultas SQL a mano en `queries.sql` | `db/queries.sql` | `docker compose exec -T db psql -U todo -d todo -v completed=true < db/queries.sql`: la primera filtra por estado y la segunda cuenta por estado. |
| Índice sobre `completed`, justificado | `tasks_completed_created_at_idx` en la migración | `docker compose exec db psql -U todo -d todo -c '\di tasks*'`. Justificación: [README](../README.md#por-qué-el-índice-sobre-completed) y la medición con `EXPLAIN ANALYZE` en [`database.md`](database.md#por-qué-el-índice-es-compuesto). |

## 5. Despliegue básico en Linux

| Requisito | Dónde | Cómo comprobarlo |
|---|---|---|
| Comandos para Ubuntu desde cero | [README, *Despliegue en Ubuntu desde cero*](../README.md#despliegue-en-ubuntu-desde-cero) | Opción A con Docker y opción B con Node y PostgreSQL instalados. |
| `docker-compose.yml` que levanta la app y la base | `docker-compose.yml` | `docker compose up --build -d` y `docker compose ps`: `db`, `backend` y `frontend` arriba; `migrate` terminado con código 0. |

## Comprobación completa desde un clon limpio

Antes de entregar una versión, conviene repetirla en una copia nueva del repositorio, sin `.env` ni `node_modules`, para confirmar que no depende de nada que solo exista en tu máquina:

```bash
git clone <url-del-repositorio> todo-app-check && cd todo-app-check
docker compose -p todo-app-check up --build -d   # -p: no se mezcla con tu pila de desarrollo
# ... las comprobaciones de las tablas de arriba, añadiendo -p todo-app-check a cada docker compose ...
docker compose -p todo-app-check down -v          # borra sus contenedores y su volumen
```

Si tu pila de desarrollo está arriba, detenla antes con `docker compose stop` (conserva los datos): las dos usan los mismos puertos.

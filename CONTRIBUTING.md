# Cómo contribuir

Guía para trabajar en el repositorio en equipo: preparar el entorno, ramas, commits, qué correr antes de un PR y qué revisar en el de otra persona. Para entender el sistema antes de cambiarlo, empieza por [`docs/architecture.md`](docs/architecture.md).

## Entorno

Requisitos: Git, Docker con Compose v2 y Node.js 24 LTS (`nvm install 24 && nvm use 24`). En Windows 11, Docker Desktop y PowerShell: las mismas órdenes, adaptadas, están en [`docs/windows.md`](docs/windows.md).

```bash
cp .env.example .env            # una vez
docker compose up -d db         # PostgreSQL en Docker
cd backend && npm ci && npm run db:deploy && cd ..
cd frontend && npm ci && cd ..
```

Después, `npm run dev` en `backend/` (http://localhost:4000) y en `frontend/` (http://localhost:3000), cada uno en su terminal. Detalle de cada orden y de las variables: README, «Instalación» y «Comandos para correr el proyecto».

- Cada paquete tiene sus dependencias y su `package-lock.json`; no hay workspaces. Instala siempre con `npm ci`, que respeta el lockfile.
- Las versiones están fijadas sin `^`. Para agregar o actualizar una dependencia: `npm install --save-exact <paquete>@<versión>` y, en el PR, por qué hace falta.
- `.editorconfig` fija la codificación, los finales de línea y la indentación (2 espacios); actívalo en tu editor. `.gitattributes` fuerza LF en cada checkout, también en Windows: no cambies `core.autocrlf` para «arreglarlo».

## Idioma

- **Código, comentarios, mensajes de la API y commits:** en inglés.
- **Documentación** (`README.md`, este archivo, `docs/`) **y textos de la interfaz:** en español.

## Ramas

- `main` siempre compila, pasa las pruebas y se puede desplegar. Nadie hace commits directos a `main`.
- Cada cambio va en una rama corta que sale de `main`:

  | Prefijo | Para qué | Ejemplo |
  |---|---|---|
  | `feature/` | Funcionalidad nueva | `feature/task-priority` |
  | `fix/` | Corrección de un error | `fix/empty-title-500` |
  | `docs/` | Solo documentación | `docs/adr-due-date` |
  | `chore/` | Dependencias, configuración, Docker | `chore/bump-next` |

- Antes de pedir revisión, actualiza la rama con `git rebase main` (no `merge`), para que el historial de `main` quede lineal.
- Un PR por cambio: si mezcla una funcionalidad con una refactorización, sepáralo en dos.

## Commits

- Asunto en inglés, en imperativo y en una línea de 72 caracteres como máximo, que describa qué hace el commit: `Add priority to tasks`, `Reject titles longer than the column`.
- Si el porqué no es evidente, deja una línea en blanco y explícalo en el cuerpo.
- Cada commit compila y pasa las pruebas por sí solo.
- El schema y la carpeta de su migración van **en el mismo commit**.
- Nunca se versionan `.env`, `node_modules/`, `dist/`, `.next/` ni `frontend/generated/` (ya están en `.gitignore`).
- Los primeros commits de la historia tienen nombres en español («Backend setup con Express y Prisma», «Frontend setup con Next.js», «Integración frontend-backend»). Son los hitos que pedía el enunciado del proyecto y se conservan así; los nuevos siguen la convención de arriba.

## Antes de abrir un PR

Con la base levantada (`docker compose up -d db`):

```bash
cd backend
npm run lint && npm run typecheck && npm test   # 31 pruebas contra la base todo_test
cd ../frontend
npm run lint && npm run typecheck && npm run build
```

Las pruebas del backend usan su propia base (`TEST_DATABASE_URL`), que se crea y se migra sola, y vacían la tabla en cada caso: nunca apuntes `TEST_DATABASE_URL` a la base de desarrollo (`vitest.config.ts` se niega a correr si coinciden). Cómo están organizadas y cómo escribir una nueva: [`docs/api.md`](docs/api.md#pruebas).

Si el cambio toca Docker, el schema o las variables, comprueba también la aplicación completa:

```bash
docker compose up --build -d
docker compose ps -a            # db y backend (healthy), frontend Up, migrate Exited (0)
```

En Windows, el mismo bloque va en PowerShell con una orden por línea ([`docs/windows.md`](docs/windows.md#pruebas-y-comprobaciones-antes-de-un-pr)).

El frontend no tiene pruebas automáticas: cualquier cambio de interfaz se prueba en el navegador (crear, completar, filtrar y eliminar) y el PR dice qué se probó.

## Qué revisar en un PR

Quien revisa comprueba, además de que el código haga lo que dice:

- **Escrituras.** Toda escritura pasa por Express. Esta búsqueda sale vacía:

  ```bash
  git grep -n -E 'prisma\.task\.(create|update|delete|upsert)' -- frontend
  ```

- **SQL.** Cada valor viaja como parámetro (`$1`), nunca concatenado en el texto. Las sentencias están en `backend/src/db/`, no en las rutas.
- **Schema.** Si cambió `schema.prisma`, hay una migración nueva junto a él, su `migration.sql` se leyó, y ninguna migración que ya estaba en `main` se editó. Una columna `NOT NULL` nueva tiene `DEFAULT`.
- **Validación.** Cada campo nuevo tiene su regla en `backend/src/validation/` (con el mismo límite que su columna) y los esquemas siguen siendo estrictos.
- **Errores.** Los errores se lanzan con `HttpError` y salen con el formato `{ "error": { "code", "message", "details"? } }`. Si hay un `code` nuevo, `frontend/lib/api.ts` tiene su mensaje en español.
- **Server y Client.** Un componente lleva `"use client"` solo si necesita estado o eventos del navegador; `lib/prisma.ts`, `lib/tasks.ts` y `lib/backend.ts` siguen importando `server-only`.
- **Pruebas.** Cada endpoint o regla nueva tiene su caso feliz y sus casos de error en `backend/tests/`.
- **Documentación.** El PR actualiza la página de `docs/` que describe lo que cambió (ver abajo). Un PR sin documentación no se aprueba.
- **Secretos.** No hay claves reales en el código ni en `.env.example`.

## Documentación

Cada cambio deja su documentación en el mismo PR:

| Si cambias… | Actualiza |
|---|---|
| Un campo o la tabla | [`docs/database.md`](docs/database.md) y [`docs/api.md`](docs/api.md); sigue [cómo agregar un campo](docs/adding-a-field.md). |
| Un endpoint, una regla o un error | [`docs/api.md`](docs/api.md) |
| Un componente, una página o un filtro | [`docs/frontend.md`](docs/frontend.md) |
| Docker, servicios o variables | [`docs/docker.md`](docs/docker.md), `.env.example` y la tabla de variables del README |
| Una orden de instalación o de desarrollo | El README y su equivalente en PowerShell en [`docs/windows.md`](docs/windows.md) |
| Una dependencia o su versión | La tabla «Tecnologías utilizadas» del README |
| Dónde se resuelve un requisito del enunciado o cómo se comprueba | [`docs/requirements.md`](docs/requirements.md) |
| Algo que contradice una decisión registrada | Un ADR nuevo (ver abajo) |

Cada archivo de código nuevo abre con un comentario breve que dice qué hace y por qué existe.

## Decisiones de arquitectura (ADR)

Una decisión que alguien podría querer revertir más adelante (quién escribe, cómo se versiona el schema, un cambio de librería) se registra en `docs/adr/` con el número siguiente y un nombre corto: `docs/adr/0003-<tema>.md`.

```markdown
# ADR 0003: <la decisión, en una frase>

- **Estado:** propuesta | aceptada | reemplazada por ADR 00NN
- **Fecha:** AAAA-MM-DD

## Contexto
Qué problema había y qué opciones se consideraron.

## Decisión
Qué se eligió y en qué archivos se nota.

## Consecuencias
Qué se gana, qué cuesta y cómo se revertiría.
```

Un ADR aceptado no se reescribe: si la decisión cambia, se escribe uno nuevo y el anterior pasa a «reemplazada por ADR 00NN». La lista está en [`docs/architecture.md`](docs/architecture.md#decisiones-registradas).

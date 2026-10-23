# Cómo agregar un campo

Recorrido completo para agregar una columna a `tasks` y llevarla hasta la pantalla. Como hay un solo schema y un solo camino de escritura ([ADR 0001](adr/0001-data-ownership.md)), el recorrido es siempre el mismo:

**schema → migración → tipo → SQL de Express → validación → pruebas → interfaz → documentación.**

El ejemplo agrega una **prioridad** (`low`, `medium` o `high`, por defecto `medium`). Se ensayó entero sobre el código actual: la migración se aplica, las pruebas del backend pasan (31 + 2 nuevas), `npm run build` del frontend compila y un `POST` con `"priority": "high"` a través de Next llega a la base y aparece en la página.

| # | Archivo | Qué cambia |
|---|---|---|
| 1 | `backend/prisma/schema.prisma` | El campo (y su `enum`, si lo tiene). |
| 2 | `backend/prisma/migrations/<fecha>_<nombre>/migration.sql` | Lo genera Prisma; se revisa y se versiona. |
| 3 | `backend/src/types/task.ts` | El tipo `Task` que devuelve la API. |
| 4 | `backend/src/db/tasks.ts` | `COLUMNS`, el `INSERT` y el `UPDATE`. |
| 5 | `backend/src/validation/tasks.ts` | La regla de entrada en `createTaskSchema` y `updateTaskSchema`. |
| 6 | `backend/tests/tasks.test.ts` | Casos felices y de error del campo. |
| 7 | `frontend/lib/api.ts` | `ApiTask`, `createTask` y el mensaje de error del campo. |
| 8 | `frontend/components/TaskList.tsx`, `TaskItem.tsx`, `NewTaskForm.tsx` | Pasar el dato, mostrarlo y pedirlo. |
| 9 | `docs/api.md`, `docs/database.md` | Las tablas de endpoints, reglas y columnas. |

Antes de empezar: la base de trabajo arriba (`docker compose up -d db`) y `.env` creado (ver el README, «Instalación»).

## 1. Schema

En `backend/prisma/schema.prisma`, el campo con un valor por defecto **en la base**: Express inserta con SQL plano y depende de que PostgreSQL rellene lo que no recibe.

```prisma
enum TaskPriority {
  low
  medium
  high
}

model Task {
  // ...
  completed   Boolean  @default(false)
  priority    TaskPriority @default(medium)
  // ...
}
```

- Nombres en camelCase en Prisma; si el nombre tiene varias palabras, agrega `@map("snake_case")` como en `createdAt`.
- Si el campo es de texto con límite, fíjalo en la columna (`@db.VarChar(n)`) y usa el mismo número en la validación (paso 5).
- Si la lista va a filtrar u ordenar por el campo, revisa el índice en [`database.md`](database.md#por-qué-el-índice-es-compuesto).

## 2. Migración

```bash
cd backend
npm run db:migrate -- --name add_task_priority
```

Prisma escribe la carpeta `prisma/migrations/<fecha>_add_task_priority/` y la aplica a la base de `DATABASE_URL`. Revisa el SQL antes de hacer commit; en el ejemplo es:

```sql
-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('low', 'medium', 'high');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "priority" "TaskPriority" NOT NULL DEFAULT 'medium';
```

Una columna `NOT NULL` en una tabla con filas necesita `DEFAULT`; sin él, la migración falla en cualquier base que ya tenga tareas. No hace falta tocar la base de pruebas: `tests/global-setup.ts` le aplica las migraciones pendientes al correr `npm test`. En Docker, el servicio `migrate` las aplica en el siguiente `docker compose up --build`.

## 3. Tipo de la API

En `backend/src/types/task.ts`, los valores posibles en un solo lugar (la validación los reutiliza) y el campo en `Task`:

```ts
export const TASK_PRIORITIES = ["low", "medium", "high"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export interface Task {
  // ...
  completed: boolean;
  priority: TaskPriority;
  createdAt: Date;
}
```

## 4. SQL de Express

En `backend/src/db/tasks.ts`, tres lugares:

```ts
// 1. Lo que devuelve cada consulta (lista, creación y edición).
const COLUMNS = `id, title, description, completed, priority, created_at AS "createdAt"`;

// 2. createTask: la columna y su parámetro.
`INSERT INTO tasks (title, description, priority) VALUES ($1, $2, $3) RETURNING ${COLUMNS}`,
[input.title, input.description, input.priority],

// 3. updateTask: una línea más con COALESCE y el parámetro al final.
            completed = COALESCE($4, completed),
            priority = COALESCE($5, priority)
// ...
[id, input.title ?? null, input.description ?? null, input.completed ?? null, input.priority ?? null],
```

Los valores van siempre como parámetros (`$5`), nunca concatenados. El `COALESCE` es lo que hace parcial al `PUT`: si el campo no llega, conserva su valor ([ADR 0002](adr/0002-partial-put.md)). **Un campo que admite `null`** (por ejemplo, una fecha límite que se puede quitar) no encaja en ese patrón, porque `COALESCE(null, columna)` deja el valor viejo. En ese caso hay que distinguir «no enviado» de «enviado como `null`»; el ADR explica las opciones.

Si las consultas a mano de `db/queries.sql` deben mostrar el campo, agrégalo también a su `SELECT`.

## 5. Validación

En `backend/src/validation/tasks.ts`:

```ts
import { TASK_PRIORITIES } from "../types/task.js";

const priority = z.enum(TASK_PRIORITIES, `priority must be one of: ${TASK_PRIORITIES.join(", ")}`);

export const createTaskSchema = z.strictObject({
  title,
  description: description.default(""),
  priority: priority.default("medium"),
});

export const updateTaskSchema = z
  .strictObject({
    // ...
    completed: z.boolean().optional(),
    priority: priority.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "Provide at least one field to update: title, description, completed or priority",
  });
```

- En la creación, el `.default()` de Zod repite el de la base: así `input.priority` siempre tiene valor y el `INSERT` no necesita casos especiales.
- En la edición, `.optional()`: si no llega, el `COALESCE` del paso 4 conserva el valor.
- Los esquemas son estrictos: hasta este paso, enviar `priority` respondía 400 por campo desconocido. Los tipos `CreateTaskInput` y `UpdateTaskInput` salen de estos esquemas solos.

## 6. Pruebas

En `backend/tests/tasks.test.ts`:

- **Ojo:** el caso «rejects an unknown field» usaba `priority` como ejemplo de campo desconocido. Cámbialo a un nombre que no exista (en el ensayo, `owner`) o esa prueba falla.
- El valor por defecto en la creación (se suma a la prueba «creates a pending task…»): `priority: "medium"` en el `toMatchObject`.
- El valor inválido, como una fila más del `it.each` de errores de `POST`: `["an unknown priority", { title: "x", priority: "urgent" }, "priority"]`.
- El cambio parcial en `PUT`: un `it("changes the priority")` que envía solo `{ priority: "high" }` y comprueba que `completed` no cambió.

```bash
npm run lint && npm run typecheck && npm test   # en backend/
```

## 7. Interfaz: tipos y llamadas

El cliente de Prisma del frontend se genera desde el mismo schema. `npm run dev`, `build` y `typecheck` lo regeneran solos; si `next dev` ya estaba corriendo, reinícialo o corre `npm run prisma:generate` en `frontend/`. Las lecturas (`lib/tasks.ts`) **no cambian**: `findMany` ya devuelve todas las columnas.

En `frontend/lib/api.ts`, el tipo, el campo de `ApiTask`, el parámetro de `createTask` y el mensaje para cuando Express rechaza el campo (se elige por el `field` de los detalles del 400):

```ts
export type Priority = "low" | "medium" | "high";

export type ApiTask = {
  // ...
  completed: boolean;
  priority: Priority;
  createdAt: string;
};

const FIELD_MESSAGE: Record<string, string> = {
  // ...
  priority: "Elige una prioridad: baja, media o alta.",
};

export async function createTask(input: { title: string; description: string; priority: Priority }) { /* ... */ }
```

Para editar el campo de una tarea existente, agrega a `lib/api.ts` una función como `setTaskCompleted` que envíe `{ priority }` por `PUT`.

## 8. Interfaz: componentes

- `components/TaskList.tsx` (Server): pasa el dato a cada fila, `priority: task.priority,`. Solo datos planos: si el campo fuera una fecha, conviértela aquí a texto como `createdAt`.
- `components/TaskItem.tsx` (Client): el campo en `TaskItemData` (`priority: Priority;`, importado de `@/lib/api`) y cómo se muestra; en el ensayo, `{task.priority === "high" && <p ...>Prioridad alta</p>}`.
- `components/NewTaskForm.tsx` (Client): un estado (`useState<Priority>("medium")`), el control (`<select name="priority">` con sus `<option>`), el valor en `createTask({ ..., priority })` y el reinicio a `"medium"` después de crear.

La pantalla la revisa una persona en el navegador: `npm run dev` en `backend/` y en `frontend/`, crear una tarea con cada valor y recargar.

```bash
npm run lint && npm run typecheck && npm run build   # en frontend/
```

## 9. Documentación

- [`api.md`](api.md): el campo en los cuerpos de `POST` y `PUT` de la tabla de endpoints y su regla en «Reglas de validación».
- [`database.md`](database.md): la fila de la columna en «La tabla `tasks`».
- Si el campo cambia el índice o una decisión, un ADR nuevo en [`adr/`](adr/).

## Antes del commit

- [ ] Schema y carpeta de la migración van en el mismo commit.
- [ ] `git grep -n priority` en `backend/` y `frontend/` muestra cada archivo de la tabla del principio.
- [ ] Lint, typecheck y pruebas en verde en los dos paquetes (ver [`CONTRIBUTING.md`](../CONTRIBUTING.md#antes-de-abrir-un-pr)).
- [ ] `docker compose up --build -d` desde cero: `migrate` termina con `Exited (0)` y la página muestra el campo.

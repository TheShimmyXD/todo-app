// Every SQL statement that touches the `tasks` table. Routes call these functions and
// never write SQL themselves, so the queries can be reviewed (and indexed) in one place.
// All values travel as parameters ($1, $2...), never concatenated into the SQL text.
import { pool } from "./pool.js";
import type { Task } from "../types/task.js";
import type { CreateTaskInput, UpdateTaskInput } from "../validation/tasks.js";

const COLUMNS = `id, title, description, completed, created_at AS "createdAt"`;

// Two separate statements instead of an optional filter, so each one maps cleanly onto
// the (completed, created_at DESC) index. See docs/database.md.
export async function listTasks(completed?: boolean): Promise<Task[]> {
  if (completed === undefined) {
    const { rows } = await pool.query<Task>(`SELECT ${COLUMNS} FROM tasks ORDER BY created_at DESC`);
    return rows;
  }
  const { rows } = await pool.query<Task>(
    `SELECT ${COLUMNS} FROM tasks WHERE completed = $1 ORDER BY created_at DESC`,
    [completed],
  );
  return rows;
}

// `id`, `completed` and `created_at` are filled by the column defaults in the database.
export async function createTask(input: CreateTaskInput): Promise<Task> {
  const { rows } = await pool.query<Task>(
    `INSERT INTO tasks (title, description) VALUES ($1, $2) RETURNING ${COLUMNS}`,
    [input.title, input.description],
  );
  return rows[0]!;
}

// Partial update: a field left out (null after `?? null`) keeps its current value
// thanks to COALESCE, so one fixed statement serves every combination of fields.
// Returns null when no task has that id.
export async function updateTask(id: string, input: UpdateTaskInput): Promise<Task | null> {
  const { rows } = await pool.query<Task>(
    `UPDATE tasks
        SET title = COALESCE($2, title),
            description = COALESCE($3, description),
            completed = COALESCE($4, completed)
      WHERE id = $1
  RETURNING ${COLUMNS}`,
    [id, input.title ?? null, input.description ?? null, input.completed ?? null],
  );
  return rows[0] ?? null;
}

// Returns false when no task has that id.
export async function deleteTask(id: string): Promise<boolean> {
  const { rowCount } = await pool.query("DELETE FROM tasks WHERE id = $1", [id]);
  return rowCount === 1;
}

// The /api/tasks endpoints. Each handler validates its input, calls one function of
// src/db/tasks.ts and sends the result; errors are thrown and answered by the error
// middleware, so handlers only describe the successful path.
import { Router } from "express";
import { createTask, deleteTask, listTasks, updateTask } from "../db/tasks.js";
import { HttpError } from "../middleware/errors.js";
import {
  createTaskSchema,
  listTasksQuerySchema,
  taskIdSchema,
  updateTaskSchema,
  validate,
} from "../validation/tasks.js";

export const tasksRouter = Router();

const taskNotFound = (id: string) => new HttpError(404, "TASK_NOT_FOUND", `No task with id ${id}`);

// GET /api/tasks?completed=true|false → 200 with the tasks, newest first.
tasksRouter.get("/", async (req, res) => {
  const { completed } = validate(listTasksQuerySchema, req.query);
  res.json(await listTasks(completed));
});

// POST /api/tasks { title, description? } → 201 with the created task.
tasksRouter.post("/", async (req, res) => {
  const input = validate(createTaskSchema, req.body);
  res.status(201).json(await createTask(input));
});

// PUT /api/tasks/:id { title?, description?, completed? } → 200 with the updated task.
tasksRouter.put("/:id", async (req, res) => {
  const { id } = validate(taskIdSchema, req.params);
  const input = validate(updateTaskSchema, req.body);
  const task = await updateTask(id, input);
  if (!task) throw taskNotFound(id);
  res.json(task);
});

// DELETE /api/tasks/:id → 204 with no body.
tasksRouter.delete("/:id", async (req, res) => {
  const { id } = validate(taskIdSchema, req.params);
  if (!(await deleteTask(id))) throw taskNotFound(id);
  res.status(204).end();
});

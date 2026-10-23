// Input rules for the task endpoints, written as zod schemas. Request data is checked
// here before it reaches the database; anything that fails becomes a 400 response with
// the list of problems (see src/middleware/errors.ts for the response format).
// Objects are strict: unknown fields are rejected instead of silently ignored.
import { z } from "zod";
import { HttpError } from "../middleware/errors.js";

// Same limit as the `title` column (VARCHAR(200) in prisma/schema.prisma).
export const TITLE_MAX_LENGTH = 200;
// The `description` column is TEXT; this cap only protects against abusive payloads.
export const DESCRIPTION_MAX_LENGTH = 2000;

const title = z
  .string()
  .trim()
  .min(1, "Title cannot be empty")
  .max(TITLE_MAX_LENGTH, `Title cannot exceed ${TITLE_MAX_LENGTH} characters`);

const description = z
  .string()
  .trim()
  .max(DESCRIPTION_MAX_LENGTH, `Description cannot exceed ${DESCRIPTION_MAX_LENGTH} characters`);

export const createTaskSchema = z.strictObject({
  title,
  description: description.default(""),
});

export const updateTaskSchema = z
  .strictObject({
    title: title.optional(),
    description: description.optional(),
    completed: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, {
    message: "Provide at least one field to update: title, description or completed",
  });

export const taskIdSchema = z.strictObject({
  id: z.uuid("Task id must be a valid UUID"),
});

// Query strings are always text, so the filter is accepted only as "true" or "false".
export const listTasksQuerySchema = z.strictObject({
  completed: z
    .enum(["true", "false"], "completed must be \"true\" or \"false\"")
    .transform((value) => value === "true")
    .optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

// Parses `data` with `schema` and returns the typed result, or throws a 400 HttpError
// whose details list each failing field and why.
export function validate<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = result.error.issues.map((issue) => ({
      // Unknown fields are reported on the parent object, so name them explicitly.
      field: issue.code === "unrecognized_keys" ? issue.keys.join(", ") : issue.path.join(".") || null,
      message: issue.message,
    }));
    throw new HttpError(400, "VALIDATION_ERROR", "The request is not valid", details);
  }
  return result.data;
}

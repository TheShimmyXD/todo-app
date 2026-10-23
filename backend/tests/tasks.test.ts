// End-to-end tests of the /api/tasks endpoints: real HTTP requests (supertest) against
// the Express app and the test database. The table is emptied before each test, so every
// test builds the data it needs.
import request from "supertest";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { pool } from "../src/db/pool.js";

const app = createApp();
const MISSING_ID = "00000000-0000-4000-8000-000000000000";

beforeEach(async () => {
  await pool.query("TRUNCATE tasks");
});

afterAll(async () => {
  await pool.end();
});

// Inserts a task directly in the database, with an explicit creation time when the
// test depends on the order.
async function insertTask(title: string, options: { completed?: boolean; createdAt?: string } = {}) {
  const { rows } = await pool.query<{ id: string }>(
    "INSERT INTO tasks (title, completed, created_at) VALUES ($1, $2, COALESCE($3::timestamptz, now())) RETURNING id",
    [title, options.completed ?? false, options.createdAt ?? null],
  );
  return rows[0]!.id;
}

describe("POST /api/tasks", () => {
  it("creates a pending task, trims the text and fills the defaults", async () => {
    const res = await request(app).post("/api/tasks").send({ title: "  Buy bread  " });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: "Buy bread", description: "", completed: false });
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(res.body.createdAt).getTime()).not.toBeNaN();

    const { rows } = await pool.query("SELECT title FROM tasks WHERE id = $1", [res.body.id]);
    expect(rows).toEqual([{ title: "Buy bread" }]);
  });

  it("stores the description", async () => {
    const res = await request(app).post("/api/tasks").send({ title: "Buy bread", description: "Whole wheat" });

    expect(res.status).toBe(201);
    expect(res.body.description).toBe("Whole wheat");
  });

  it.each([
    ["an empty title", { title: "   " }, "title"],
    ["a title over 200 characters", { title: "a".repeat(201) }, "title"],
    ["a title that is not text", { title: 5 }, "title"],
    ["a missing title", { description: "x" }, "title"],
    ["an unknown field", { title: "x", priority: 1 }, "priority"],
    ["a completed flag (tasks are created pending)", { title: "x", completed: true }, "completed"],
  ])("rejects %s with 400", async (_case, body, field) => {
    const res = await request(app).post("/api/tasks").send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toContainEqual(expect.objectContaining({ field }));
  });

  it("rejects a request without a JSON body", async () => {
    const res = await request(app).post("/api/tasks");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects malformed JSON", async () => {
    const res = await request(app).post("/api/tasks").set("Content-Type", "application/json").send('{"title":');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });

  it("rejects a body over 10 kB", async () => {
    const res = await request(app).post("/api/tasks").send({ title: "x", description: "a".repeat(11_000) });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe("PAYLOAD_TOO_LARGE");
  });
});

describe("GET /api/tasks", () => {
  it("returns an empty list when there are no tasks", async () => {
    const res = await request(app).get("/api/tasks");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns the newest task first", async () => {
    await insertTask("old", { createdAt: "2026-01-01T10:00:00Z" });
    await insertTask("new", { createdAt: "2026-01-03T10:00:00Z" });
    await insertTask("middle", { createdAt: "2026-01-02T10:00:00Z" });

    const res = await request(app).get("/api/tasks");

    expect(res.status).toBe(200);
    expect(res.body.map((task: { title: string }) => task.title)).toEqual(["new", "middle", "old"]);
  });

  it("filters by status", async () => {
    await insertTask("pending");
    await insertTask("done", { completed: true });

    const done = await request(app).get("/api/tasks?completed=true");
    const pending = await request(app).get("/api/tasks?completed=false");

    expect(done.body.map((task: { title: string }) => task.title)).toEqual(["done"]);
    expect(pending.body.map((task: { title: string }) => task.title)).toEqual(["pending"]);
  });

  it.each([["completed=yes"], ["completed=1"], ["sort=title"]])("rejects the query %s with 400", async (query) => {
    const res = await request(app).get(`/api/tasks?${query}`);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("PUT /api/tasks/:id", () => {
  it("changes only the fields sent", async () => {
    const id = await insertTask("Buy bread");

    const res = await request(app).put(`/api/tasks/${id}`).send({ completed: true });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id, title: "Buy bread", description: "", completed: true });
  });

  it("updates title and description together", async () => {
    const id = await insertTask("Buy bread");

    const res = await request(app).put(`/api/tasks/${id}`).send({ title: " Buy milk ", description: "Skimmed" });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ title: "Buy milk", description: "Skimmed", completed: false });
  });

  it("rejects a body without fields", async () => {
    const id = await insertTask("Buy bread");

    const res = await request(app).put(`/api/tasks/${id}`).send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a completed flag that is not a boolean", async () => {
    const id = await insertTask("Buy bread");

    const res = await request(app).put(`/api/tasks/${id}`).send({ completed: "true" });

    expect(res.status).toBe(400);
  });

  it("rejects an id that is not a UUID", async () => {
    const res = await request(app).put("/api/tasks/abc").send({ completed: true });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toContainEqual(expect.objectContaining({ field: "id" }));
  });

  it("returns 404 for an id that does not exist", async () => {
    const res = await request(app).put(`/api/tasks/${MISSING_ID}`).send({ completed: true });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TASK_NOT_FOUND");
  });
});

describe("DELETE /api/tasks/:id", () => {
  it("deletes the task and answers 204 without a body", async () => {
    const id = await insertTask("Buy bread");

    const res = await request(app).delete(`/api/tasks/${id}`);

    expect(res.status).toBe(204);
    expect(res.text).toBe("");
    const { rowCount } = await pool.query("SELECT 1 FROM tasks WHERE id = $1", [id]);
    expect(rowCount).toBe(0);
  });

  it("returns 404 for an id that does not exist", async () => {
    const res = await request(app).delete(`/api/tasks/${MISSING_ID}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("TASK_NOT_FOUND");
  });

  it("rejects an id that is not a UUID", async () => {
    const res = await request(app).delete("/api/tasks/abc");

    expect(res.status).toBe(400);
  });
});

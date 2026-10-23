// Tests of the behavior shared by the whole API: the health check, unknown routes and
// how unexpected errors are answered. Database failures are simulated by making the
// pool's `query` reject once, so no test needs to stop the real database.
import request from "supertest";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { pool } from "../src/db/pool.js";

const app = createApp();

function failNextQuery(message: string) {
  vi.spyOn(pool, "query").mockImplementationOnce(() => Promise.reject(new Error(message)));
}

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  await pool.end();
});

describe("GET /health", () => {
  it("answers ok when the database responds", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("answers 503 when the database does not respond", async () => {
    failNextQuery("connection refused");

    const res = await request(app).get("/health");

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe("DATABASE_UNAVAILABLE");
  });
});

describe("error handling", () => {
  it("answers 404 with the common format for an unknown route", async () => {
    const res = await request(app).get("/api/unknown");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "NOT_FOUND", message: "Route GET /api/unknown does not exist" } });
  });

  it("answers 500 without exposing the original error", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    failNextQuery("secret internal detail");

    const res = await request(app).get("/api/tasks");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: { code: "INTERNAL_ERROR", message: "Something went wrong on the server" } });
    expect(JSON.stringify(res.body)).not.toContain("secret");
    expect(logged).toHaveBeenCalled();
  });

  it("does not advertise Express in the headers", async () => {
    const res = await request(app).get("/health");

    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

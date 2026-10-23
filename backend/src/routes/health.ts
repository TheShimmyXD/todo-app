// GET /health: tells whether the API can reach its database. Docker's healthcheck and
// anyone debugging a deployment use it; 200 means ready, 503 means the database is down.
import { Router } from "express";
import { pool } from "../db/pool.js";
import { HttpError } from "../middleware/errors.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
  } catch {
    throw new HttpError(503, "DATABASE_UNAVAILABLE", "The database is not reachable");
  }
  res.json({ status: "ok" });
});

// Builds the Express application without starting to listen, so the tests can use it
// directly and src/server.ts can add the network and shutdown concerns on top.
// Order matters: body parser, then routes, then the 404 handler, then the error handler.
import express from "express";
import { errorHandler, notFoundHandler } from "./middleware/errors.js";
import { healthRouter } from "./routes/health.js";
import { tasksRouter } from "./routes/tasks.js";

export function createApp() {
  const app = express();

  // Do not advertise the framework in every response header.
  app.disable("x-powered-by");
  // Task payloads are a few hundred bytes; anything above this limit is rejected (413).
  app.use(express.json({ limit: "10kb" }));

  app.use("/health", healthRouter);
  app.use("/api/tasks", tasksRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

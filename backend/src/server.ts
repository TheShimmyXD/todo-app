// Entry point of the API process: starts the HTTP server and shuts it down cleanly.
// On SIGTERM (what `docker stop` sends) or SIGINT (Ctrl+C) it stops accepting requests,
// lets the ones in progress finish and then closes the database pool.
import { createApp } from "./app.js";
import { env } from "./config.js";
import { pool } from "./db/pool.js";

// If something keeps the server from closing (a stuck request), exit anyway after this.
const SHUTDOWN_TIMEOUT_MS = 10_000;

const server = createApp().listen(env.API_PORT, (error) => {
  if (error) {
    console.error(`Could not start the API on port ${env.API_PORT}:`, error.message);
    process.exit(1);
  }
  console.log(`API listening on http://localhost:${env.API_PORT}`);
});

let shuttingDown = false;

function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down`);

  setTimeout(() => {
    console.error("Shutdown took too long, forcing exit");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS).unref();

  server.close(async () => {
    await pool.end();
    console.log("Server and database pool closed");
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// The single PostgreSQL connection pool of the process. Every query in the API goes
// through it, so connections are reused instead of opened per request. Sizes and
// timeouts come from the environment (see src/config.ts for the defaults and why).
import pg from "pg";
import { env } from "../config.js";

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: env.DB_POOL_MAX,
  idleTimeoutMillis: env.DB_POOL_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: env.DB_POOL_CONNECTION_TIMEOUT_MS,
});

// An idle connection can drop (database restart, network cut). Without this listener
// the error would crash the process; the pool already discards the broken client and
// opens a new one on the next query, so logging is enough.
pool.on("error", (error) => {
  console.error("Unexpected error on an idle database connection:", error.message);
});

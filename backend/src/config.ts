// Reads and validates the environment once, at startup, so a missing or malformed
// variable stops the process with a clear message instead of failing on the first request.
// Like prisma.config.ts, it loads the single `.env` at the repository root; variables
// already present in the environment (Docker, CI, tests) take precedence.
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

// `src/config.ts` and the compiled `dist/config.js` sit at the same depth, so the
// relative path to the root `.env` works in development and in production builds.
loadEnv({ path: fileURLToPath(new URL("../../.env", import.meta.url)), quiet: true });

const positiveInt = (fallback: number) => z.coerce.number().int().positive().default(fallback);

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  // Maximum number of open connections. 10 is plenty for this API and leaves room
  // in PostgreSQL's default `max_connections` (100) for Prisma and other clients.
  DB_POOL_MAX: positiveInt(10),
  // How long an unused connection stays open before the pool closes it.
  DB_POOL_IDLE_TIMEOUT_MS: positiveInt(30_000),
  // How long a request waits for a free connection (or for the database to answer
  // the handshake) before failing, instead of hanging when the database is down.
  DB_POOL_CONNECTION_TIMEOUT_MS: positiveInt(5_000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`);
  console.error(`Invalid environment configuration:\n${problems.join("\n")}`);
  process.exit(1);
}

export const env = parsed.data;

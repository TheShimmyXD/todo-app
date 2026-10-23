// Test runner configuration. The tests talk to a real PostgreSQL database, but never to
// the development one: they use TEST_DATABASE_URL (a separate database in the same
// container), which tests/global-setup.ts creates and migrates before the first test.
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { defineConfig } from "vitest/config";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error("TEST_DATABASE_URL is not set. Copy it from .env.example into .env.");
}
// Every test empties the tasks table: refuse to run against the development database.
if (testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL must point to a different database than DATABASE_URL.");
}

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: "tests/global-setup.ts",
    // The API under test reads DATABASE_URL (src/config.ts); point it at the test database.
    env: { DATABASE_URL: testDatabaseUrl },
    // All files share one database and truncate it, so they must not run at the same time.
    fileParallelism: false,
  },
});

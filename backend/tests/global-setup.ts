// Runs once before the whole test suite: makes sure the test database exists and has
// the latest schema. It creates the database on first use (connecting to the server's
// default `postgres` database) and then applies the Prisma migrations to it, exactly as
// `npm run db:deploy` does for the development database.
import { execFileSync } from "node:child_process";
import pg from "pg";

export async function setup() {
  const testUrl = new URL(process.env.TEST_DATABASE_URL!);
  const databaseName = decodeURIComponent(testUrl.pathname.slice(1));

  // The name ends up inside SQL as an identifier, which cannot be a parameter.
  if (!/^[A-Za-z0-9_]+$/.test(databaseName)) {
    throw new Error(`Unexpected test database name: ${databaseName}`);
  }

  const serverUrl = new URL(testUrl);
  serverUrl.pathname = "/postgres";
  const client = new pg.Client({ connectionString: serverUrl.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]);
    if (rowCount === 0) {
      await client.query(`CREATE DATABASE "${databaseName}"`);
    }
  } finally {
    await client.end();
  }

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: testUrl.toString() },
    stdio: "pipe",
  });
}

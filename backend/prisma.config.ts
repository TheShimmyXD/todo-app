// Prisma CLI configuration: where the schema and the migrations live and which
// database the migrate commands talk to.
// Prisma 7 no longer reads `.env` on its own. The project keeps a single `.env`
// at the repository root, so it is loaded here explicitly. Variables already
// present in the environment (Docker, CI) win, and a missing file is not an error.
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { defineConfig, env } from "prisma/config";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});

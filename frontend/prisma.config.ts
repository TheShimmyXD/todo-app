// Prisma CLI configuration for the frontend: it only generates the read-only
// client from the backend schema, which is the single source of truth.
// Migrations are never run from here; they belong to `backend/`
// (`npm run db:migrate` there). No datasource is declared because generating
// the client does not connect to the database.
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "../backend/prisma/schema.prisma",
});

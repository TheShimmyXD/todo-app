// Shared Prisma client for Server Components. Read-only by convention: Next.js
// never creates, updates or deletes tasks; every write goes through the Express
// API (see README, "Lectura y escritura").
// Prisma 7 needs a driver adapter, so the client is built on top of `pg` via
// `@prisma/adapter-pg`. In development, hot reload re-evaluates this module on
// every change; caching the instance on `globalThis` avoids opening a new
// connection pool each time.
import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env at the repository root.");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

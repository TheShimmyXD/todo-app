// Shared Prisma client for Server Components. Read-only by convention: Next.js
// never creates, updates or deletes tasks; every write goes through the Express
// API (see README, "Lectura y escritura").
// Prisma 7 needs a driver adapter, so the client is built on top of `pg` via
// `@prisma/adapter-pg`. In development, hot reload re-evaluates this module on
// every change; caching the instance on `globalThis` avoids opening a new
// connection pool each time.
// The client is created on first use, not when the module is imported:
// `next build` imports this file while it collects page data, and the build
// (Docker image included) must not need a database URL.
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

let client: PrismaClient | undefined = globalForPrisma.prisma;

/** Returns the shared client, creating it on the first call. */
export function getPrisma(): PrismaClient {
  if (!client) {
    client = createClient();
    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.prisma = client;
    }
  }
  return client;
}

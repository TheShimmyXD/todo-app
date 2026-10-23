// Next.js configuration.
// The project keeps a single `.env` at the repository root (shared with the
// backend and docker compose), but Next.js only reads `.env` files from its own
// folder, so the root file is loaded here. Variables already present in the
// environment (Docker, CI) win, and a missing file is not an error.
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import type { NextConfig } from "next";

config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });

const nextConfig: NextConfig = {
  // The Docker image sets NEXT_OUTPUT=standalone so `next build` writes
  // `.next/standalone`: a minimal `server.js` plus only the files it needs
  // (frontend/Dockerfile). Elsewhere the regular output is kept, because
  // `next start` (`npm start`) does not support standalone builds.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  // Cache Components (the Next.js 16 default for new apps): data is dynamic
  // unless marked with "use cache", and request-time data streams inside
  // <Suspense>. Partial Prefetching must be set explicitly alongside it.
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

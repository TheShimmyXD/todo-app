# Image of the Express API. Build context: `backend/` (see docker-compose.yml).
# Multi-stage so the final image carries only compiled JavaScript and production
# dependencies. A second target, `migrate`, keeps the Prisma CLI to apply the
# migrations before the API starts (the `migrate` service in docker compose).
# Debian slim instead of Alpine: Prisma's schema engine expects glibc and OpenSSL.
# Stages only use classic Dockerfile syntax, so they build with or without BuildKit.

FROM node:24.22.1-trixie-slim AS base
WORKDIR /app/backend

# All dependencies (TypeScript and the Prisma CLI are dev dependencies).
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# Compiles src/ to dist/.
FROM deps AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# Production dependencies only (express, pg, zod, dotenv).
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Final API image: `node dist/server.js` as the unprivileged `node` user.
FROM base AS runtime
ENV NODE_ENV=production
COPY package.json ./
COPY --from=prod-deps /app/backend/node_modules ./node_modules
COPY --from=build /app/backend/dist ./dist
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]

# One-shot image that runs `prisma migrate deploy` and exits. It is the last
# stage so building the `runtime` target never has to build it.
FROM deps AS migrate
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
COPY prisma.config.ts ./
COPY prisma ./prisma
USER node
CMD ["node_modules/.bin/prisma", "migrate", "deploy"]

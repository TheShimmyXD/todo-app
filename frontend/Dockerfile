# Image of the Next.js app. Build context: the repository root (see
# docker-compose.yml), because the Prisma client is generated from
# `backend/prisma/schema.prisma`, the single schema of the project.
# Next.js builds with `output: "standalone"`, so the final image holds only the
# traced files and a minimal `server.js`, without the full node_modules.
# Stages only use classic Dockerfile syntax, so they build with or without BuildKit.

FROM node:24.22.1-trixie-slim AS base
WORKDIR /app/frontend
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# `npm run build` runs `prisma generate` first (prebuild). The schema is copied
# to the same relative place as in the repository, so the generator's `output`
# path (`../../frontend/generated/prisma`) resolves to this package.
FROM deps AS build
ENV NEXT_OUTPUT=standalone
COPY backend/prisma/schema.prisma /app/backend/prisma/schema.prisma
COPY frontend/ ./
RUN npm run build

# Final image: the standalone server plus the static assets, which `next build`
# leaves out of the standalone folder on purpose.
FROM base AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/frontend/.next/standalone ./
COPY --from=build --chown=node:node /app/frontend/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]

# syntax=docker/dockerfile:1
# --- api image (multi-stage: deps -> build -> release) -------------------------
# The api serves the REST api and owns the SQLite file (in-process, no db server).

FROM node:22-alpine AS base
# sqlite3 (the CLI) is used for the WAL-safe `.backup` snapshots
RUN apk add --no-cache sqlite
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /app
ENV PNPM_HOME=/usr/local/bin

FROM base AS deps
COPY . .
RUN pnpm install --frozen-lockfile

FROM deps AS build
RUN pnpm --filter @mult/shared build && pnpm --filter api build

# runtime dependencies only (keeps the image small)
FROM base AS prod-deps
COPY . .
RUN pnpm install --frozen-lockfile --prod --filter api... --filter @mult/shared...

FROM base AS release
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV DATABASE_PATH=/data/app.db
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod-deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/package.json ./package.json
WORKDIR /app/apps/api
RUN mkdir -p /data
EXPOSE 3000
# the api applies the migrations at boot (idempotent)
CMD ["node", "dist/src/index.js"]

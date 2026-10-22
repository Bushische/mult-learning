# Architecture

## Repos
Monorepo (pnpm workspaces):
- `apps/api`        Fastify + TypeScript + Drizzle ORM + better-sqlite3
- `apps/web`        React + Vite + TypeScript + Tailwind (PWA)
- `packages/shared` zod schemas + shared DTO types

## Containers (docker-compose)
1. `api`     node:22-alpine — Fastify app; volume: `data` (SQLite db). Node 22 is the
             minimum for `better-sqlite3@13` (NAPI prebuilds — no compiler in the image).
2. `web`     dev: node:22-alpine with Vite dev server + `/api` proxy to `api:3000`;
              prod: nginx:alpine serving built static files + reverse proxy `/api` → `api:3000`

**No database container.** SQLite runs in-process via `better-sqlite3`; the DB file lives on the
`data` volume (`/data/app.db`, WAL mode). On the 1 GB NAS a separate database server would cost
~50–120 MB idle; SQLite in-process costs < 5 MB — the whole stack stays under ~150 MB.

## Networking
- Internal network: bridge.
- `web` proxies `/api/*` → `api:3000` (identical topology in dev and prod).
- Public exposure via Synology Container Manager port mapping / reverse proxy — no tunnel
  service by default. Add an extra compose profile only if a tunnel is desired later.
- SQLite: single writer (the `api` container). WAL mode allows concurrent readers in-process.

## Data flow
```
Web (browser) → nginx (prod) / vite proxy (dev) → /api → Fastify → Drizzle → SQLite file (data volume)
```

## SQLite pragmas (set at api startup, once in the db module)
- `journal_mode = WAL`
- `foreign_keys = ON`
- `busy_timeout = 5000`
- `synchronous = NORMAL`

## Secrets
- `.env` (gitignored) read by `docker-compose.yml`: `JWT_SECRET`, `PORT`, `DATABASE_PATH`. See `.env.example`.

## Persistence
- `data` volume → `/data/app.db` (+ `-wal`, `-shm`). Dev maps it to `./local-data/` via
  `docker-compose.override.yml`.

## Backups
- Daily `sqlite3 /data/app.db ".backup /backups/app-YYYY-MM-DD.db"` (crash-consistent, WAL-safe)
  via the NAS scheduler; retention 14 daily snapshots. Restore = delete stale `-wal`/`-shm`,
  copy snapshot in place. Full runbook: `docs/DEPLOYMENT.md`.

## Build & deploy (no CI/CD — laptop only)
- Dev: `docker compose up` (api `node --watch`, web Vite dev server + proxy).
- Prod: multi-stage Dockerfiles; build arm64 images locally
  (`docker buildx build --platform linux/arm64`), transfer to the NAS
  (`docker save | ssh nas docker load`) and run via Synology Container Manager / compose.
- Runbook: `docs/DEPLOYMENT.md`.

## Frontend build
- Vite; PWA via `vite-plugin-pwa` (installable, offline app shell — cached static assets,
  network-first for `/api` with graceful degradation to cached UI).

## Dev tooling
- pnpm workspaces, Biome (lint + format), vitest at the root (`pnpm test` covers all packages).
- Tests for the API run against an in-memory SQLite (`:memory:`) with migrations applied per suite.

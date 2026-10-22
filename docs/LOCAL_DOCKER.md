# Local Docker dev environment

## Requirements
- Docker Desktop (compose v2)
- pnpm 9+ (`corepack enable`) for editor-only work — the containers themselves run node:20.

## Quick start

```bash
cp .env.example .env       # set JWT_SECRET (see .env flow below)
docker compose up          # boots api + web (dev servers)
```

- `web` (http://localhost:5173) proxies `/api` to the `api` service — the same
  topology as production.
- Volume `data` (`/data/app.db`, overridden by `docker-compose.override.yml` to
  `./local-data`) persists across restarts. `local-data/` is gitignored.
- `.env` flow: `docker-compose.yml` reads `NODE_ENV`, `PORT`, `JWT_SECRET`, `DATABASE_PATH`
  from `.env` (gitignored; template in `.env.example`). Copy it once; never commit `.env`.
- The `docker-compose.override.yml` redirects the Docker volume to `./local-data/`
  so local runs don't hide the DB inside Docker-managed volumes.

## Without Docker

```bash
corepack enable
pnpm install
pnpm --filter api dev      # Fastify on :3000 (once T2 lands)
pnpm --filter web dev      # Vite on :5173 (once T10 lands)
```

## Troubleshooting
- Healthcheck "unhealthy": the api service is only healthy after T2 lands (`/health`).
- Port conflicts: `PORT` (api, 3000) and `WEB_PORT` (5173) both come from `.env`.

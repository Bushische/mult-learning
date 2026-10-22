# Execution Log — T2 — API bootstrap: Fastify app, config, error handler, /health

- Task: T2
- Status: DONE
- Date: 2026-10-22
- Commit: cef0400
- Model: opencode/minimax-m3.1-flash-free

## Notes
- Routes: `/health` and `/api/health` live at the root; every API resource is mounted
  under the `/api` prefix (refresh cookie `Path=/api/auth` depends on it).
- `better-sqlite3@13` is used because v11 has no prebuild for Node 26 (compile fails).
- `docker-compose.yml` now mounts the repo root (`.:/app`) so pnpm's workspace
  `node_modules` symlinks stay valid inside the container.

## Session notes
- 2026-10-22 | T2 | opencode/minimax-m3.1-flash-free | Bootstrapped apps/api: zod config, FastifyHttpError + error handler, /health, dev-server.mjs, compose wiring; app+config tests green.

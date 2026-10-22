# Execution Log — T16 — Deployment: arm64 images, prod compose, Synology runbook + smoke tests

- Task: T16
- Status: DONE
- Date: 2026-10-22
- Commit: f5a494b
- Model: opencode/minimax-m3.1-flash-free

## Notes
- DEVIATION: the runtime image is `node:22-alpine` (not node 20) — `better-sqlite3@13`
  requires node >= 22. `pnpm.neverBuiltDependencies: [better-sqlite3]` keeps pnpm from
  compiling it (the prebuilt NAPI binary ships with the package).
- DEVIATION: the shared package was renamed from `packages/shared` to `@mult/shared`
  (the directory stays `packages/shared/`). A slash in a bare specifier is interpreted by
  Node as a subpath, so the api image could not resolve the package at runtime.
- The api image ships the `sqlite3` CLI (apk add sqlite) so the WAL-safe `.backup` snapshots
  can be taken from inside the container (the runbook depends on it).
- The compose healthcheck uses `127.0.0.1` (in the container `localhost` resolves to ::1
  and the api listens on IPv4 only).

Verified on the laptop (2026-10-22):
- `scripts/build-images.sh` → `mult-learning-api:latest` (240 MB) + `mult-learning-web:latest`
  (63 MB) for linux/arm64.
- `docker compose -f docker-compose.prod.yml up -d` → api healthy, web on :8080;
  `/`, `/manifest.webmanifest`, `/sw.js`, `/icons/icon-192.png` → 200, `/api/health` → 200.
- `scripts/smoke.sh` → `SMOKE: ok — health, login, answer and stats all work`
  (health, admin login, child games, one answer POST, heatmap + daily stats).
- Restore drill: `.backup` → stop api → delete `-wal`/`-shm` → `cp` the snapshot back →
  start → `users` still holds `admin|admin` + `child1|user` and the smoke test passes.
- RAM: api 27.8 MiB / 128 MiB, web 7.1 MiB / 32 MiB (docker stats).

## Session notes
- 2026-10-22 | T16 | opencode/minimax-m3.1-flash-free | Added arm64 Dockerfiles, prod compose (128m/32m), build/deploy/smoke/backup scripts, rewritten DEPLOYMENT.md runbook + 5 deployment tests; images build, stack + restore drill verified.

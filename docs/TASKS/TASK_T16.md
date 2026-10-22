# T16 — Deployment: arm64 images, prod compose, Synology runbook + smoke tests

- **Goal:** the app ships to the Synology DS223j and runs under Container Manager with backups.
- **Inputs:** docs/ARCHITECTURE.md (build/deploy + backups), docs/DEPLOYMENT.md (template).
- **Outputs:** `apps/api/Dockerfile` (multi-stage: deps → build → release, distroless-ish
  alpine, `tsc` build, migrations at boot), `apps/web/Dockerfile` (build → nginx serving
  static + `/api` proxy config), `docker-compose.prod.yml` (api 128m / web 32m mem limits,
  data volume, host port mapping e.g. 8080), `scripts/build-images.sh`
  (`docker buildx --platform linux/arm64`), `scripts/deploy.sh` (save/load transfer +
  up), rewritten `docs/DEPLOYMENT.md` runbook IN THIS REPO'S FORM (Container Manager
  flow, first-run `db:seed` invocation, `.env` on the NAS, SQLite `.backup` daily schedule +
  restore drill steps).
- **Test cases:**
  1. `pnpm --filter api build` type-checks & bundles cleanly; Docker images build for
     linux/arm64 on the laptop (script completes, both images present).
  2. `docker compose -f docker-compose.prod.yml up` on any local Docker: /health 200, login
     with seeded admin, one answer POST flows, heatmap renders — smoke list runbook-able.
  3. Restore drill (documented steps): `.backup` snapshot → delete `-wal`/`-shm` → restore →
     container boots with restored data intact (executed as script + documented in the runbook).
- **Definition of Done:** Test cases pinned where automatable (case 1 as package build +
  scripts; case 2 partially scriptable smoke → `scripts/deploy.sh` idempotent); full gate
  `pnpm test && pnpm lint`; NAS-level checks documented for a human rehearsal inside
  `docs/DEPLOYMENT.md`.
- **Dependencies:** T4, T15

# Execution Log — T3 — DB layer: Drizzle schema, migrations, pragmas, seed

- Task: T3
- Status: DONE
- Date: 2026-10-22
- Commit: 7eb2b62
- Model: opencode/minimax-m3.1-flash-free

## Notes
- Migrations live in `apps/api/drizzle/` (drizzle-kit). The folder is located by
  searching upwards from the module, so `src/db` and `dist/src/db` both work.
- `db:seed` / `db:migrate` use `loadDatabaseConfig()` (DATABASE_PATH only) — the server
  config requires PORT, which scripts do not need.
- Build output is `dist/src/**` + `dist/scripts/**` (rootDir `.`), start script is
  `node dist/src/index.js`.

## Session notes
- 2026-10-22 | T3 | opencode/minimax-m3.1-flash-free | Added Drizzle schema (5 tables), client with 4 pragmas, migrations + idempotent migrate, seed (admin/child1/2 games) and db tests; gate green.

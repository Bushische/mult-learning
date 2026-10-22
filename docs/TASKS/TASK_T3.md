# T3 — DB layer: Drizzle schema, migrations, pragmas, seed

- **Goal:** every table from the contract exists with migrations + seed for admin and demo data.
- **Inputs:** docs/DATA_MODEL.md (verbatim), docs/ARCHITECTURE.md (pragmas).
- **Outputs:** `apps/api/src/db/schema.ts` (all 5 tables per DATA_MODEL), `client.ts`
  (better-sqlite3 + the 4 pragmas, applied once), `migrate.ts` (idempotent, runs at boot),
  `drizzle.config.ts` + `drizzle/` folder, `scripts/seed.ts`
  (`pnpm --filter api db:seed`): admin username `admin` (pin 1289), demo `child1` (pin 2468),
  games "Easy Twos" (2–4 × 1–4) and "Mixed Table" (1–10 × 1–10) with default economics
  (+10s/−5s, cap 3600, variantCount 3); assignments for child1.
- **Test cases:**
  1. All 5 tables exist after migrate; re-running migrate is a no-op (idempotent).
  2. Pragmas observable: `journal_mode = WAL`, `foreign_keys = ON` on a test client.
  3. Deleting a user cascades their assignments + stats rows (FK behavior).
  4. Seed runs twice without dupes (unique username / games by name).
- **Definition of Done:** Test cases pinned by `apps/api/src/db/*.test.ts` on `:memory:`;
  full gate `pnpm test && pnpm lint`.
- **Dependencies:** T2

# T28 — Readable child stats with per-game results and a 7-day day×game table

- **Goal:** the admin child-stats page clearly shows who earned what today and per game, plus a 7-day table (rows = days, columns = games).
- **Inputs:** `apps/web/src/features/admin/pages/UserStatsPage.tsx`, `apps/web/src/features/admin/api.ts`, `apps/api` answers/stats routes and services, `docs/DATA_MODEL.md`, `docs/API.md` (neither `daily_stats` nor `matrix_stats` records `game_id` today — per-game breakdowns need a recording/schema extension), `packages/shared/src/index.ts`.
- **Outputs:** per-day per-game stats recording (schema + shared schemas + endpoints for admin: header data and 7-day day×game matrix); reworked `UserStatsPage` header card and 7-day table.
- **Test cases:**
  1. Setup: child with answers today in two games. Action: admin opens `/admin/users/:id/stats`. Expected: the header card shows the child's name, today's earned seconds (not the lifetime bank), and today's correct/total; below, every assigned game shows its name with today's correct/total and earned seconds.
  2. Setup: child played on three of the last 7 days in two games. Action: admin scrolls to the 7-day table. Expected: one row per day (labelled `DD.MMM`), one column per assigned game, each cell showing that day's earned seconds and correct/total for that game; days/games with no play show a dash.
  3. Setup: child with no assigned games. Action: admin opens the stats page. Expected: the games section reads "No games assigned." and the 7-day table is absent.
  4. Setup: signed in as a non-admin. Action: `GET` the new stats endpoints. Expected: `403` with the standard error envelope.
  5. Setup: answer submitted for a game. Action: re-request the stats endpoints. Expected: the new day×game data already includes the just-recorded attempt (no stale cache).
- **Definition of Done:** test cases 1–5 pinned by API tests (`apps/api`) and web tests (`apps/web/src/features/admin/`); full gate `pnpm test && pnpm lint`.
- **Dependencies:** T27

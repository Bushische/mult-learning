# T18 — Admin leaderboard: today first, last 7 days second

- **Goal:** the admin dashboard shows the day's ranking first and the 7-day ranking after it.
- **Inputs:** feedback #1. `services/adminStatsService.ts` (`getLeaderboard` is 7-day only),
  `routes/admin/*`, shared `LeaderboardRow`, `features/admin/components/LeaderboardTable.tsx`,
  `features/admin/pages/AdminPage.tsx`, `docs/API.md` (leaderboard row).
- **Outputs:** `GET /admin/leaderboard` returns both windows in one payload
  `{ "today": LeaderboardRow[], "last7Days": LeaderboardRow[] }` (each row unchanged:
  `userId, username, timeEarnedSeconds, accuracy` ranked by earned desc). Today = `daily_stats`
  rows with `date = today UTC`; last7Days = the existing rolling window.
  Update `docs/API.md` + the shared schema. Admin dashboard renders two titled tables,
  "Today" before "Last 7 days".
- **Test cases:**
  1. A has 60 s today / 90 s 7-day, B has 120 s today / 300 s 7-day: today table = B, A;
     7-day table = B, A (independent rankings).
  2. C has activity only 3 days ago: today row shows 0 s (still listed), 7-day includes it.
  3. A child with no tries has `accuracy: null` (UI renders 0%).
  4. DOM order: the "Today" table appears before "Last 7 days" (asserted by test ids/order).
  5. Child token on `GET /admin/leaderboard` → 403; no token → 401.
- **Definition of Done:** test cases 1–5 pinned by `routes/admin/games.test.ts` (or a new
  `routes/admin/leaderboard.test.ts`) + `features/admin/admin.test.tsx`; full gate
  `pnpm test && pnpm lint`.
- **Dependencies:** T17

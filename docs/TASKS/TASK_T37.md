# T37 — Correct/Wrong show prices, all Today figures show net of penalties

- **Goal:** no more gross-vs-bank confusion — Correct/Wrong lines show the per-turn price/fine, and every "today" aggregate is net (earned minus lost).
- **Inputs:** `GameList.tsx` (rows), `DailyStatsCard.tsx`, `HistoryList.tsx`, `AppHeader` `todayEarned`, `DashboardPage.tsx` (aggregation), `UserStatsPage.tsx` (today header + week Total column), per-game data (T28: tries/correct/earned per game per day) + game `timePenalty`. Lost seconds are derived (`wrong × penalty`), nothing new stored.
- **Outputs:** game rows: green `Correct +<price>s`, red `Wrong −<fine>s` (game economics, no pills of statistics), plus `Today: ±M:SS (C/T)` where the value is net (`earned − wrong × penalty`, signed display). Dashboard today card, header pill, history rows, admin today header and week Total column all use the shared rule: per-game rows present → net; only legacy pre-T28 days (totals but no rows) → gross daily totals; idle → dash/omit.
- **Test cases:**
  1. Setup: game +10/−5, today 2 correct (+20) and 1 wrong. Action: open `/`. Expected: `Correct +0:10`, `Wrong −0:05`, `Today: +0:15 (2/3)`; header and today card also `+0:15`.
  2. Setup: unplayed game. Action: open `/`. Expected: prices still visible, `Today: +0:00 (0/0)`.
  3. Setup: only legacy pre-T28 activity yesterday. Action: open `/` and the admin stats page. Expected: the history row and week Total column show the gross day numbers (with game cells dashed); nothing is hidden.
  4. Setup: dashboard open, new answers recorded. Action: wait 16 s. Expected: card totals and header update in place to the new net values.
- **Definition of Done:** test cases 1–4 pinned in dashboard/admin tests; full gate `pnpm test && pnpm lint`.
- **Dependencies:** T30, T34, T35, T36

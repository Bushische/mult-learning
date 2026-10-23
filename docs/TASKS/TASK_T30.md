# T30 — Child home redesign: today card, per-game rows, 7-day history

- **Goal:** the child home page leads with today's earnings, then per-game results, then recent history, then the heatmap.
- **Inputs:** `apps/web/src/features/dashboard/pages/DashboardPage.tsx`, `DailyStatsCard`, `GameList`, `HeatmapGrid`, per-day per-game stats built in T28, `packages/shared/src/index.ts`.
- **Outputs:** reworked dashboard sections (today card, games list with results, 7-day history list) reusing the T28 data on child endpoints.
- **Test cases:**
  1. Setup: child with 6 tries / 4 correct / +50 s today. Action: open `/`. Expected: one "Today" card line showing the earned time big, and smaller gray "4/6 correct" next to it.
  2. Setup: child assigned two games, played one today. Action: look at the games list. Expected: every game row shows its name, today's earned seconds for that game, and today's correct/total for that game; the unplayed game shows zeros.
  3. Setup: child played on three of the last 7 days. Action: scroll to the history. Expected: one row per day labelled `DD.MMM`, each with that day's earned seconds and correct/total; days without play are omitted or dashed.
  4. Setup: child with heatmap data. Action: scroll down. Expected: the heatmap grid is still rendered below the history.
  5. Setup: offline API. Action: open `/`. Expected: the existing offline banner is shown and no section crashes.
- **Definition of Done:** test cases 1–5 pinned in `apps/web/src/features/dashboard/` tests; full gate `pnpm test && pnpm lint`.
- **Dependencies:** T28

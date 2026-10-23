# T38 — 7-day stats show the newest day first

- **Goal:** in every 7-day list the closest day is on top — no scrolling to today.
- **Inputs:** `HistoryList.tsx` (child home), `UserStatsPage.tsx` week table (admin), `summarizeDay` (unchanged math).
- **Outputs:** both lists render newest-first (today at the top, oldest at the bottom); rows keep their testids and values.
- **Test cases:**
  1. Setup: three active days (3, 1, 0 days ago). Action: open `/`. Expected: history rows run today, yesterday, 3-days-ago from top to bottom.
  2. Setup: same data, admin stats page with games assigned. Action: open the page. Expected: week-table rows run newest-first too.
- **Definition of Done:** test cases 1–2 pinned in dashboard/admin tests; full gate `pnpm test && pnpm lint`.
- **Dependencies:** T28, T30

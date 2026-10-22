# T7 — Stats read API: rolling 7-day heatmap + daily stats

- **Goal:** the dashboard data — recent mastery per (a,b) cell, today's numbers.
- **Inputs:** docs/API.md (Stats section, verbatim), docs/DATA_MODEL.md (matrix_stats).
- **Outputs:** `src/services/statsService.ts` + `src/routes/stats.ts`: `GET /stats/heatmap`
  (window = `timestamp ≥ now − 7d`, aggregated per cell with tries/correct/accuracy/color
  buckets none/green≥0.8/mixed/red<0.5, seeded over the union of the user's assigned games'
  ranges — allowedCombinations when set) and `GET /stats/daily` (today's row or zeros).
- **Test cases:**
  1. A cell answered correctly 5/5 times within the window is green with accuracy 1.
  2. A cell answered 2/8 within the window is red; 5/8 → mixed (0.8 boundary = green).
  3. A matrix_stats row with timestamp 8 days ago is EXCLUDED from every cell (rolling only).
  4. A combo in ranges but never answered appears with tries 0 and color "none".
  5. Two differently-ranged assigned games → heatmap covers their union.
  6. `GET /stats/daily` reflects exactly the rows `POST /answers` wrote today; a fresh user
     sees zeros (not 404).
  7. Unauthenticated → 401.
- **Definition of Done:** Test cases 1–7 pinned by `apps/api/src/routes/stats.test.ts`
  (fixed `now` injection for the window boundary); full gate `pnpm test && pnpm lint`.
- **Dependencies:** T6

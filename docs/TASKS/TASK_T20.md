# T20 — Child stats page: heatmap + last-7-days usage

- **Goal:** the page behind a leaderboard name shows recent mastery and activity totals.
- **Inputs:** feedback #3. T19's `UserStatsPage`, `HeatmapGrid` (reuse), stats service
  (own-user heatmap logic in `services/statsService.ts`), `docs/API.md`.
- **Outputs:** admin endpoint `GET /admin/users/:id/stats` (requireAdmin) →
  ```json
  { "user": { "id", "username", "timeBankSeconds" },
    "heatmap": [ HeatmapCell ],
    "last7Days": { "attempts": n, "correct": n, "incorrect": n, "earnedSeconds": n } }
  ```
  heatmap = rolling 7-day window (same buckets as `GET /stats/heatmap`, union of the child's
  assigned game ranges); totals = sums of `daily_stats` rows in the 7-day window
  (`incorrect = attempts − correct`). Update `docs/API.md` + shared schema. Page renders the
  heatmap plus four tiles: Attempts, Correct, Incorrect, Earned (clock format).
- **Test cases:**
  1. Seeded child: attempts/correct/earned match the `daily_stats` sums; incorrect = attempts − correct.
  2. A `matrix_stats` row 8 days old is absent from the page's heatmap; 2 days old is present.
  3. No activity: heatmap all "none", totals all 0 (page still renders, no error).
  4. Cells outside the child's assigned ranges never appear.
  5. Child token → 403; unknown user → 404.
  6. UI renders the four values + heatmap from the endpoint payload.
- **Definition of Done:** test cases 1–6 pinned by a new API route test + 
  `features/admin/admin.test.tsx`; full gate `pnpm test && pnpm lint`.
- **Dependencies:** T19

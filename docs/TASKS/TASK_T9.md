# T9 — Admin: games CRUD, leaderboard, daily overview

- **Goal:** admins build/configure games and see comparisons across children.
- **Inputs:** docs/API.md (Admin section rows 7–10 + Games shape), docs/DATA_MODEL.md.
- **Outputs:** `src/routes/admin/games.ts` (+ services): `GET/POST /admin/games`,
  `PATCH/DELETE /admin/games/:id` (zod-validated config: factor ranges 1..20 min ≤ max,
  variantCount 3..6, non-negative economics; 400 VALIDATION_ERROR otherwise);
  `GET /admin/leaderboard` (7-day earned time desc + accuracy, from daily_stats rows);
  `GET /admin/stats/daily?date=YYYY-MM-DD` (default today).
- **Test cases:**
  1. Admin creates a game (2–4 × 5–8, 3 variants) with hints; a child assigned later sees it
     with all fields intact.
  2. Invalid config (rangeA.min > rangeA.max; variantCount 2; factor 25) → 400
     VALIDATION_ERROR, nothing created.
  3. PATCH changes reward/penalty; DELETE removes the game and its assignments (child's games
     list shrinks); unknown id → 404.
  4. Leaderboard ranks two seeded children by 7-day earned time; accuracy is the 7-day
     correct/tries ratio; a child with no activity shows 0 / null accuracy.
  5. `GET /admin/stats/daily?date=<yesterday>` shows yesterday's rows; child token → 403.
- **Definition of Done:** Test cases 1–5 pinned by `apps/api/src/routes/admin/games.test.ts`;
  full gate `pnpm test && pnpm lint`.
- **Dependencies:** T8

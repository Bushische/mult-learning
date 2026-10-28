# T48 — Stats, heatmap, and history keyed by operation

- **Goal:** progress tracking stays exact when one game mixes operations.
- **Inputs:** T42–T44, `matrix_stats` (keyed by factors only today), heatmap/dashboard/admin stats pipeline.
- **Outputs:** `matrix_stats.operation` column + migration; heatmap cells carry `op`; dashboard heatmap renders one section per operation in the game; per-game daily rows stay per game (unchanged shape); admin child page groups the 7-day table by operation.
- **Test cases:**
  1. Setup: mixed game, answers in `+` and `×`. Action: open heatmap data. Expected: separate `(add, a, b)` and `(mul, a, b)` cells — no cross-operation mixing.
  2. Setup: old `matrix_stats` rows without operation. Action: migrate + query heatmap. Expected: legacy rows read as `mul`, nothing lost.
  3. Setup: child played only `+` this week. Action: open the dashboard. Expected: the `×` heatmap section shows all-neutral, the `+` section shows the data.
- **Definition of Done:** cases 1–3 pinned by API + web tests; full gate `pnpm test && pnpm lint`.
- **Dependencies:** T47

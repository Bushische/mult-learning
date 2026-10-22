# Execution Log — T7 — Stats read API: rolling 7-day heatmap + daily stats

- Task: T7
- Status: DONE
- Date: 2026-10-22
- Commit: eadf1e6
- Model: opencode/minimax-m3.1-flash-free

## Notes
- The heatmap is seeded with the union of the user's assigned games' combinations
  (`allowedCombinations` when set, otherwise the full A×B range).
- Buckets: green ≥ 0.8, mixed ≥ 0.5, red < 0.5, none when tries = 0; accuracy is the raw
  ratio (not rounded).

## Session notes
- 2026-10-22 | T7 | opencode/minimax-m3.1-flash-free | Added statsService (rolling 7d window, cell aggregation, color buckets) + GET /api/stats/heatmap and /api/stats/daily; 8 tests green.

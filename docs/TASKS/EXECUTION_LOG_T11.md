# Execution Log — T11 — Dashboard: header bank, 7-day heatmap, daily stats, game selection

- Task: T11
- Status: DONE
- Date: 2026-10-22
- Commit: ca699ec
- Model: opencode/minimax-m3.1-flash-free

## Notes
- The heatmap is a pure display: axes are derived from the cells returned by
  `GET /api/stats/heatmap` (no client-side math), colours come from the API bucket.
- The shared query client moved to `src/lib/query-client.ts` so the answer flow can
  invalidate `["me"]`, `["daily"]`, `["heatmap"]` (used by the play screen in T12).
- Test case 6 of the spec (answer → heatmap/daily refresh) belongs to the play loop and is
  pinned in T12 together with the invalidation.

## Session notes
- 2026-10-22 | T11 | opencode/minimax-m3.1-flash-free | Replaced the dashboard stub with header bank, heatmap grid, daily card and game list (+10s/−5s, Let's Play!); 5 dashboard tests green.

# Execution Log — T48 — Stats, heatmap, and history keyed by operation

- Task: T48
- Status: DONE
- Date: 2026-10-28
- Commit: ebb02f3
- Model: meta/muse-spark-1.3-contributor

## Notes
- `matrix_stats.operation` NOT NULL default `'mul'` (migration 0007); `submitAnswer` records `request.operation`; pre-T48 rows aggregate as `mul`.
- Heatmap cells carry `op`; `combinationsForGames` emits per-(op,a,b); aggregation keyed `op:a:b`. Per-game daily rows untouched.
- Dashboard `HeatmapGrid` renders one section per operation (`heatmap-section-{op}`, cells `cell-{op}-{a}-{b}`, symbol labels).
- Admin child 7-day table groups columns by operation (`week-op-{op}` headers, cells `week-cell-{date}-{op}-{gameId}`; mixed games appear under each op with per-game numbers).
- Docs: DATA_MODEL matrix_stats/correctness, API.md heatmap cell shape.
- T48 cases pinned by API stats tests (separate add/mul cells, legacy-as-mul) + dashboard section test (only-+ played).

## Session notes
- 2026-10-28 | T48 | meta/muse-spark-1.3-contributor | op-keyed stats+heatmap; full gate green (220 tests, lint, web build)

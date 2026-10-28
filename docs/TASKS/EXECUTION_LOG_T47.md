# Execution Log — T47 — Game studio: operation picker

- Task: T47
- Status: DONE
- Date: 2026-10-28
- Commit: 333698f
- Model: meta/muse-spark-1.3-contributor

## Notes
- `GameStudioForm` has an Operations checkbox group (`+ − × ÷`, stable order, at least one required with inline `error-operations`); form state round-trips `operations` through the shared schema; `duplicate` preserves them; `GameList` shows the symbols per game.
- T47 cases pinned by API tests (POST mixed list, PATCH list, empty list 400) + studio tests (create Plus-and-Minus, uncheck-all error, ×-only edit defaults).

## Session notes
- 2026-10-28 | T47 | meta/muse-spark-1.3-contributor | studio op picker; api+web tests green

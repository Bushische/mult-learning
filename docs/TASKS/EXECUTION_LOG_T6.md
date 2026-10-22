# Execution Log — T6 — Answer submission: time bank, matrix + daily stats (server-side)

- Task: T6
- Status: DONE
- Date: 2026-10-22
- Commit: f54ceb4
- Model: opencode/minimax-m3.1-flash-free

## Notes
- `timeDelta` in the response is the delta that actually reached the bank (0 at the cap or
  at 0), per T6 test case 4 — docs/API.md literally defines the raw ±reward/penalty.
- All writes (bank update, matrix_stats insert, daily_stats upsert) run in one
  `db.transaction`; `time_earned_seconds` only absorbs positive deltas.

## Session notes
- 2026-10-22 | T6 | opencode/minimax-m3.1-flash-free | Added answerService (assignment check, correctness, bank clamp, transactional matrix+daily writes) + POST /api/answers; 6 tests green.

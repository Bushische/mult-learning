# T6 — Answer submission: time bank, matrix + daily stats (server-side)

- **Goal:** one endpoint drives the whole game loop economy, authoritatively server-side.
- **Inputs:** docs/API.md (Answers section, verbatim), docs/DATA_MODEL.md (matrix_stats,
  daily_stats, users.time_bank_seconds).
- **Outputs:** `src/services/answerService.ts` + `src/routes/answers.ts` (`POST /answers`):
  assignment check → correctness (`chosen === a*b`, `null` = timeout) → timeDelta =
  ±reward/penalty → bank clamp [0, maxDailyTime] → `matrix_stats` insert (transaction with
  `daily_stats` upsert; time_earned absorbs only positive deltas). Full atomicity: one
  `db.transaction`.
- **Test cases:**
  1. Correct answer on an assigned game: response `correct: true`, `timeDelta` = reward,
     bank grows by the reward; `matrix_stats` row (correct=1) and today's `daily_stats`
     (tries+1, correct+1) observable via direct DB read in the test.
  2. Wrong answer: bank drops by the penalty, but never below 0 after repeated wrong answers.
  3. Timeout (`chosen: null`): treated as wrong — same as case 2 behavior.
  4. Answering when the bank is already at the cap: response `correct: true` but
     `timeDelta = 0`; `daily_stats.time_earned` stays at its previous value.
  5. Answering a game NOT assigned to the user → 403 FORBIDDEN; unknown gameId → 404.
  6. Unauthenticated → 401.
- **Definition of Done:** Test cases 1–6 pinned by `apps/api/src/routes/answers.test.ts`
  (Fastify inject + raw :memory: DB reads); full gate `pnpm test && pnpm lint`.
- **Dependencies:** T5, T3

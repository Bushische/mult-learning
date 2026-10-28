# T44 — Answer checking per operation

- **Goal:** correct means right for `+ − × ÷`, timeouts still count as wrong.
- **Inputs:** T43 questions, `POST /answers` (answerService correctness, `chosen === a*b` today).
- **Outputs:** server-side `applyOp(a, b, op)` used for correctness (`chosen === applyOp(...)`, `null` = wrong); everything else (reward, penalties, bank, stats writes) untouched.
- **Test cases:**
  1. Setup: assigned mixed game. Action: answer `7 + 5` with 12, `9 − 4` with 5, `8 ÷ 2` with 4. Expected: `correct: true` each time, reward credited.
  2. Setup: same. Action: answer `7 + 5` with 13. Expected: `correct: false`, penalty applied.
  3. Setup: same. Action: timeout (`chosen: null`). Expected: wrong, penalty applied, one `matrix_stats` row.
- **Definition of Done:** cases 1–3 pinned by API route tests; full gate `pnpm test && pnpm lint`.
- **Dependencies:** T43

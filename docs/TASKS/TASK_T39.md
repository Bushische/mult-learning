# T39 — Time bank is per day: expires at midnight, earned fresh each day

- **Goal:** every day the child starts at zero and can earn up to the game's daily cap again — no permanent lifetime bank.
- **Inputs:** `apps/api/src/services/answerService.ts` (bank clamp `[0, maxDailyTime]`), `users.time_bank_seconds` (docs/DATA_MODEL.md), `POST /answers` (docs/API.md), seed/reset paths.
- **Outputs:** a per-user bank day marker (e.g. `users.bank_date YYYY-MM-DD`): on the first answer of a new UTC day the bank resets to 0 before applying the delta (same transaction); the daily cap applies to the fresh day's earnings only. `resetUserProgress` clears it; docs/DATA_MODEL.md + docs/API.md updated (`GET /me`, Answers).
- **Test cases:**
  1. Setup: child earned 100 s yesterday (bank 100). Action: answer correctly today. Expected: bank equals only today's reward (yesterday's 100 is gone); `daily_stats` keeps both days' rows.
  2. Setup: child hit the cap yesterday. Action: answer correctly today. Expected: full reward credited (cap restarts), bank grows from 0.
  3. Setup: two correct answers same day near the cap. Action: second answer. Expected: clamped to `maxDailyTime` as before (intraday behavior unchanged).
  4. Setup: admin resets a child mid-day. Action: answer. Expected: bank grows from 0 (reset also clears the day marker).
  5. Setup: unauthenticated. Action: `POST /answers`. Expected: 401 (existing guard unchanged).
- **Definition of Done:** test cases 1–5 pinned by `apps/api` route/service tests; contracts updated in the same commit; full gate `pnpm test && pnpm lint`.
- **Dependencies:** T38

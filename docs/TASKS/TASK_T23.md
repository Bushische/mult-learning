# T23 — Time-decayed reward: waiting/pausing costs earning

- **Goal:** a correct answer no longer always pays the full reward — the longer you take, the
  less you earn; the first 3 seconds stay free, after that the reward shrinks proportionally.
- **Inputs:** feedback #7. `docs/API.md` (Games shape, Answers), `docs/DATA_MODEL.md` (games),
  `services/answerService.ts` (fixed `rawDelta`), shared `Game` / `AnswerRequest`,
  `features/play/pages/PlayPage.tsx` (countdown + submit), admin `GameStudioForm.tsx`.
- **Outputs:**
  - Shared pure helper + grace constant: `REWARD_GRACE_MS = 3000`,
    `computeRewardSeconds({ baseTimeReward, questionSeconds, elapsedMs })`:
    `e = clamp(elapsedMs, 0, questionSeconds*1000)`; full reward while `e ≤ 3000`;
    otherwise `round(baseTimeReward * (D·1000 − e) / (D·1000 − 3000))` clamped `[0, base]`
    (D = `questionSeconds`); never negative.
  - Contract: games gain `questionSeconds` (integer **5..60**, default **15**) — update
    `docs/DATA_MODEL.md`, `docs/API.md`, DB schema + migration, game CRUD/admin studio
    (a "seconds per question" field), shared `Game`/`GameConfig`.
  - `POST /answers` gains required `elapsedMs` (integer ≥ 0, clamped server-side); when
    correct, `timeDelta = +computeRewardSeconds(...)`, when wrong/timeout `-timePenalty`.
  - Web: countdown length = `game.questionSeconds`; submit `elapsedMs` measured from the
    moment the countdown starts (timeout sends the full duration).
- **Test cases:**
  1. base 10 s, questionSeconds 15: elapsed 0 ms → +10; elapsed 2000 ms → +10 (grace).
  2. elapsed 9000 ms → `round(10 * (15000−9000)/(15000−3000))` = +5.
  3. elapsed 15000 ms (or more, clamped) → correct with +0 (bank unchanged).
  4. Wrong at elapsed 0 → bank drops by `timePenalty`; timeout (`chosen: null`) same penalty.
  5. Missing/negative/non-integer `elapsedMs` → 400 VALIDATION_ERROR; `questionSeconds` 4 or 61
     rejected, 5..60 accepted.
  6. Web: the countdown for a game with `questionSeconds` 20 runs 20 s (not the old 15).
  7. Web: waiting ~9 s then answering correctly shows the reduced time added in the session
     (reward 5, not 10) — the "I always get max" symptom is gone.
- **Definition of Done:** test cases 1–7 pinned by API route tests + shared helper tests +
  `features/play/play.test.tsx`; `docs/API.md` / `docs/DATA_MODEL.md` updated in the same
  commit; full gate `pnpm test && pnpm lint`.
- **Dependencies:** T22

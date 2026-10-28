# T41 — A correct answer always earns at least the penalty back

- **Goal:** thinking long is never punished with +0 — a slow correct answer still pays at least what a mistake would cost.
- **Inputs:** `computeRewardSeconds` (shared: linear shrink to 0 at timeout), `POST /answers` (correct → `+reward`), play feedback + earning bar (show the new floor).
- **Outputs:** the decay floor is the game's own `timePenalty`: `computeRewardSeconds` gains a `timePenalty` input and clamps to `[min(timePenalty, baseTimeReward), baseTimeReward]` instead of `[0, base]` (grace period unchanged); the earning bar's min label follows the same floor. docs/API.md Answers section updated. The bank cap still wins: at a full bank the credited delta stays +0 (cap, not reward).
- **Test cases:**
  1. Setup: base 10 s, penalty 5 s, question 15 s. Action: correct at 14 999 ms. Expected: reward `+5` (was `+0`).
  2. Setup: same. Action: correct at 0 ms / inside grace. Expected: still full `+10` (floor changes nothing fast).
  3. Setup: bank already at cap. Action: slow correct answer. Expected: response `correct: true`, credited delta `+0` (cap), stats still count the try.
  4. Setup: fresh question, max reward 10 s, penalty 5 s. Action: answer correctly at the last moment. Expected: feedback shows `+0:05` (never `+0:00` for a correct answer when the bank isn't full).
  5. Setup: wrong answer / timeout. Action: submit. Expected: penalty path unchanged (floor applies to correct answers only).
  6. Setup: earning bar at `remaining = 0`. Action: render. Expected: the min label reads the penalty floor (`+0:05` for penalty 5), not `+0:00`.
- **Definition of Done:** test cases 1–3 pinned by shared/API tests, 4–6 by play tests; full gate `pnpm test && pnpm lint`.
- **Dependencies:** T38

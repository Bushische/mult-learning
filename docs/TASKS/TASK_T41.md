# T41 — A correct answer always earns at least +1 second

- **Goal:** thinking long is never punished with +0 — a correct answer always pays a minimum reward.
- **Inputs:** `computeRewardSeconds` (shared: linear shrink to 0 at timeout), `POST /answers` (correct → `+reward`), play feedback (`+0:05`-style deltas).
- **Outputs:** shared floor `MIN_REWARD_SECONDS = 1`: the decayed reward clamps to `[1, baseTimeReward]` instead of `[0, baseTimeReward]` (grace period unchanged); docs/API.md Answers section updated. The bank cap still wins: at a full bank the credited delta stays +0 (cap, not reward).
- **Test cases:**
  1. Setup: base 10 s, question 15 s. Action: correct at 14 999 ms. Expected: reward `+1` (was `+0`).
  2. Setup: same. Action: correct at 0 ms / inside grace. Expected: still full `+10` (floor changes nothing fast).
  3. Setup: bank already at cap. Action: slow correct answer. Expected: response `correct: true`, credited delta `+0` (cap), stats still count the try.
  4. Setup: fresh question, max reward 10 s. Action: answer correctly at the last moment. Expected: feedback shows `+0:01` (never `+0:00` for a correct answer).
  5. Setup: wrong answer / timeout. Action: submit. Expected: penalty path unchanged (floor applies to correct answers only).
- **Definition of Done:** test cases 1–3 pinned by shared/API tests, 4–5 by play tests; full gate `pnpm test && pnpm lint`.
- **Dependencies:** T38

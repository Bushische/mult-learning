# T12 — Play screen: slot-machine roll, variants, feedback, session summary

- **Goal:** the core loop is playable end-to-end on a tablet with the exact pedagogy.
- **Inputs:** docs/PROJECT.md (screen D), docs/API.md (Answers), docs/OVERVIEW.md.
- **Outputs:** `features/play/` for `/play/:gameId`: question generator within the game's
  ranges/allowedCombinations; **two-stage roll** (Num1 locks fast, Num2 decelerating via
  requestAnimationFrame); countdown HUD (shrinking bar, seconds per question = comfortable
  default 15 s, constant per game), live bank ticker; `variantCount` answer buttons in
  **randomized positions** (1 correct + distractors around `a*b`); tap → immediate flash
  (green/red), correct answer highlighted + number shown on miss; POST /answers per try;
  Magic-Rules hint bubble when the rolled factor matches a game hint; **Stop / Finish**
  between questions → session summary (questions, accuracy %, final bank time added; two
  buttons: Play more / back to dashboard); timeouts auto-submit `chosen: null`.
- **Test cases:**
  1. Every rolled question's factors fall inside the game's configured ranges/combination list.
  2. Tapping the correct button flashes green and the bank ticker increases by the reward;
     tapping wrong flashes red AND reveals the correct answer; both recorded via POST /answers.
  3. When the timer runs out with no answer: red feedback, `chosen: null` submitted, bank
     drops by the penalty; next question starts cleanly.
  4. Answer buttons: each question shuffles positions (no stable slot over >10 questions) and
     shows exactly `variantCount` options with exactly one correct.
  5. A hint configured for factor 10 shows its bubble text when Num1 or Num2 = 10; none otherwise.
  6. "Stop / Finish" mid-session lands on a summary with correct counts (tries, accuracy %,
     bank added = sum of positive deltas) and "Play more" continues without losing state.
  7. Navigating back mid-roll cancels timers/rAF — no stray submissions after unmount.
- **Definition of Done:** Test cases 1–7 pinned by `features/play/*.test.tsx` (animation-free
  assertions on decide/thresholds; timers mocked); full gate `pnpm test && pnpm lint`.
- **Dependencies:** T11

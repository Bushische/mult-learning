# T32 — Common shared magic rules plus per-game rules on feedback

- **Goal:** every game teaches shortcuts from one shared rule set, while a game can still add its own rules; one matching rule card shows on every answer.
- **Inputs:** `apps/web/src/features/play/pages/PlayPage.tsx` (hint memo, `HintBubble`, feedback buttons), `Game.hints` (per-game rules today), `packages/shared/src/index.ts` (home for the shared rule list so games and tests import one source).
- **Outputs:** a shared rule set (factor-based, applied to all games) merged with the game's own rules; per-question random pick among all matching rules; a rule card rendered below the Stop/Finish buttons on both correct and wrong feedback.
- **Starter rule set** (factor → card text; matching when the factor is either side of the question):
  - 0 → "Times 0 — the answer is always 0."
  - 1 → "Times 1 — the number stays the same."
  - 2 → "Times 2 — just double it: 7 × 2 = 7 + 7."
  - 4 → "Times 4 — double it, then double again."
  - 5 → "Times 5 — take times 10, then half: 7 × 5 = 70 ÷ 2."
  - 9 → "Times 9 — take times 10, then subtract once: 7 × 9 = 70 − 7."
  - 10 → "Times 10 — just add a 0 at the end!"
- **Test cases:**
  1. Setup: question 7 × 10 in a game with no own rules. Action: answer (correct or wrong). Expected: below the Stop/Finish buttons a rule card explains the ×10 shortcut.
  2. Setup: game with its own rule for ×7, question 7 × 4. Action: answer. Expected: the card shows the game's own ×7 rule text.
  3. Setup: question matching two or more rules (shared + per-game). Action: answer the same question under several fixed RNG seeds. Expected: different seeds can show different matching rules, but every shown rule matches the question's factors.
  4. Setup: question matching no rule. Action: answer. Expected: no rule card is rendered, feedback and buttons are unchanged.
  5. Setup: timeout with no tap on a question matching a rule. Action: let the countdown expire. Expected: the rule card appears together with the wrong-answer feedback.
- **Definition of Done:** test cases 1–5 pinned by shared/web tests colocated with the code; full gate `pnpm test && pnpm lint`.
- **Dependencies:** T27

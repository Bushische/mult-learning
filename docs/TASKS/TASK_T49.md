# T49 — Play HUD labeling per operation

- **Goal:** the equation always reads naturally: `7 + 5 = ?`, `9 − 4 = ?`, `8 ÷ 2 = ?`.
- **Inputs:** T43 questions (operation carried), `SlotDisplay` / PlayPage equation area, countdown/bank HUD (operation-agnostic already).
- **Outputs:** the equation renders with `+ − × ÷` symbols per question (slots, feedback copy "The answer was N", summary); bank/session-earned/delta copy unchanged.
- **Test cases:**
  1. Setup: mixed game. Action: play one round of each operation type. Expected: each equation shows its own symbol (`+`, `−`, `×`, `÷`).
  2. Setup: wrong `−` answer. Action: submit. Expected: feedback shows the right answer with the framed seconds, unchanged format.
  3. Setup: timeout on a `÷` question. Action: let it expire. Expected: `chosen: null` submission, wrong-answer feedback, no crash.
- **Definition of Done:** cases 1–3 pinned in play tests; full gate `pnpm test && pnpm lint`.
- **Dependencies:** T48

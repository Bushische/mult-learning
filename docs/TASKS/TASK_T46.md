# T46 — Magic rules per operation

- **Goal:** shortcut cards teach `+ − ÷` tricks too, not just `×`.
- **Inputs:** T32 shared rules (factor-based, `×`-only), per-game `hints`, the feedback rule card.
- **Outputs:** rules gain an optional operation scope (shared `+0`, `−0`, `×0/×1`, `÷1`, `÷n÷n=1` starters; game hints may scope to an operation too); matching considers the question's operation; the card renders on feedback as today.
- **Test cases:**
  1. Setup: `5 + 0`, game without own rules. Action: answer. Expected: the shared `+0` rule card shows.
  2. Setup: `9 ÷ 9`, game with an own `÷` rule. Action: answer. Expected: the game's own rule card shows.
  3. Setup: question matching rules of two operations. Action: answer. Expected: only rules scoped to the question's operation can appear.
  4. Setup: question matching nothing. Action: answer. Expected: no card, feedback otherwise unchanged.
- **Definition of Done:** cases 1–4 pinned by shared + play tests; full gate `pnpm test && pnpm lint`.
- **Dependencies:** T45

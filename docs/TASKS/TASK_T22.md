# T22 — Play HUD: clear Bank line (earned vs max)

- **Goal:** the game screen's top line makes the bank unambiguous: earned of the cap.
- **Inputs:** feedback #5. `features/play/pages/PlayPage.tsx` HUD block
  (`Bank: {bank}s`), `game.maxDailyTime`, `formatDuration` from T17.
- **Outputs:** top line with three labelled values:
  `Bank` → `<bank> / <game.maxDailyTime>` (earned vs max, both `formatDuration`),
  plus a small `earned this session` value already tracked (`bankAdded`). E.g.
  `Bank 0:45 / 1:00:00` and `session +0:30`. Keep it on one wrapping line, ≥40 px targets not
  affected; test ids `bank`, `bank-max`, `session-earned`.
- **Test cases:**
  1. A game with cap 3600 and bank 45 renders "Bank 0:45 / 1:00:00".
  2. Taking a correct answer updates the earned value on the same line (bank + session).
  3. A wrong answer reduces the bank but never below "0:00 / <max>".
  4. The label "earned" (or equivalent) is present so the left number is not mistaken for the cap.
- **Definition of Done:** test cases 1–4 pinned in `features/play/play.test.tsx`; full gate
  `pnpm test && pnpm lint`.
- **Dependencies:** T17

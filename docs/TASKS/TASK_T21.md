# T21 — Game summary says "options", not "answers"

- **Goal:** the game list's short description stops implying answer attempts.
- **Inputs:** feedback #4. `features/admin/games/components/GameList.tsx:27`
  (`{game.variantCount} answers`), any other copy using "answers" for variant count.
- **Outputs:** the summary reads `{variantCount} options · +10s / −5s` (e.g. "3 options");
  no occurrence of "N answers" remains in the admin game list or its tests.
- **Test cases:**
  1. The admin game list for variantCount 3 shows "3 options".
  2. The string "3 answers" appears nowhere in the rendered admin games list.
  3. Existing economics text (`+10s / −5s`) is unchanged.
- **Definition of Done:** test cases 1–3 pinned in `features/admin/games/games.test.tsx`
  (update the old assertion); full gate `pnpm test && pnpm lint`.
- **Dependencies:** (none)

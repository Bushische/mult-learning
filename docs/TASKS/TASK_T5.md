# T5 — Games read API with per-role visibility

- **Goal:** children see exactly their assigned games with full config; admins see all.
- **Inputs:** docs/API.md (Games section), docs/DATA_MODEL.md (games, user_game_assignments).
- **Outputs:** `src/services/gameService.ts`, `src/routes/games.ts` (`GET /games`), zod
  response validation from `packages/shared`; JSON columns parsed to DTO
  (`allowedCombinations`, `hints`).
- **Test cases:**
  1. Child with one assigned game gets exactly that game with all fields
     (ranges, variants, economics, hints) matching the seeded data.
  2. Admin (role admin) gets ALL games including unassigned ones.
  3. Unauthenticated request → 401 UNAUTHORIZED.
  4. A game with `allowed_combinations_json` NULL serializes as `"allowedCombinations": null`.
- **Definition of Done:** Test cases pinned by `apps/api/src/routes/games.test.ts`;
  full gate `pnpm test && pnpm lint`.
- **Dependencies:** T5

# T1 — Shared contracts: zod schemas + DTO types

- **Goal:** both apps and future tasks speak exactly one language for every API shape.
- **Inputs:** docs/API.md, docs/DATA_MODEL.md.
- **Outputs:** `packages/shared/src/` — zod schemas + inferred DTO types for: user (login grid
  entry, user with role, full admin user), game (full shape incl. `rangeA/rangeB`,
  `allowedCombinations: [number, number][] | null`, `hints: {factor, text}[]`, 3..6 variantCount,
  ranges 1..20 min ≤ max), login/refresh/logout request+response, answer request
  (`{gameId, factorA, factorB, chosen: number | null}`) + response, heatmap cell
  (`color: none|green|mixed|red`, `accuracy: number | null`), daily stats, leaderboard row,
  admin daily row. Export everything via `packages/shared/src/index.ts`.
- **Test cases:**
  1. A valid game config parses (ranges 2–4 × 5–8, variantCount 3) and survives stringify/parse.
  2. variantCount of 2 and 7 is rejected; factor range 21 rejected; rangeA.min > rangeA.max rejected.
  3. Answer request rejects non-integer chosen, missing gameId; accepts `chosen: null` (timeout).
  4. Heatmap cell rejects color "blue"; accepts accuracy null with tries 0.
  5. TypeScript-only consumers compile (tsc -p . on the package).
- **Definition of Done:** Test cases 1–4 pinned by `packages/shared/*.test.ts`; case 5 by
  `pnpm --filter packages/shared build` + full gate `pnpm test && pnpm lint`.
- **Dependencies:** (none)

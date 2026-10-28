# T43 — Question generator supports mixed operations per game

- **Goal:** one game can mix `+ − × ÷`, rolled from its configured operation list.
- **Inputs:** T42 contracts, `features/play/lib/question.ts` (`generateQuestion`, ranges, `allowedCombinations`).
- **Outputs:** `generateQuestion` picks an operation from the game's list, then operands in range: subtraction generates `a ≥ b` (no negative results for kids); division generates exact divisions only (divisor ≥ 1, integer quotient, e.g. pick quotient and divisor first); the question carries its operation.
- **Test cases:**
  1. Setup: game with `operations: ["add", "sub", "mul", "div"]`. Action: generate 200 questions (fixed seed). Expected: every operation appears; every question stays in range.
  2. Setup: same game. Action: inspect 200 questions. Expected: no subtraction has `a < b`; no division has a remainder or a zero divisor.
  3. Setup: game with `operations: ["mul"]`. Action: generate questions. Expected: identical behavior to today (only `×`).
- **Definition of Done:** cases 1–3 pinned in `lib/question.test.ts` style; full gate `pnpm test && pnpm lint`.
- **Dependencies:** T42

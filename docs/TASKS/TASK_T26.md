# T26 — Misleading distractor options (not just ±1)

- **Goal:** wrong answer buttons look plausible and teach discrimination, not just proximity.
- **Inputs:** feedback #9. `features/play/lib/question.ts` (`buildOptions` uses ±1..±10
  offsets), `play.test.tsx` assertions.
- **Outputs:** `buildOptions` takes the factors and builds candidates from multiplication
  mistakes plus proximity: `a*(b−1)`, `a*(b+1)`, `(a−1)*b`, `(a+1)*b`, `right ±1`, `right ±2`,
  `right ±10`, `10*a`, `10*b`. Deduplicate, drop `≤ 0` and the correct answer, then pick
  `variantCount − 1` distinct values with the injected RNG and shuffle. Example for 3 × 4
  (N=3): one correct (12) and two from `{9, 15, 8, 16, 13, 11}` — not two near-copies of 12.
  Update `generateQuestion` to pass the factors.
- **Test cases:**
  1. 3 × 4 with N=3: options contain 12 exactly once and at least one nearby-table product
     from `{9, 15, 8, 16}`.
  2. No duplicates and exactly `variantCount` options for N = 3..6.
  3. The option set is not composed solely of `right ± 1/±2` when neighbours exist
     (at least one candidate differs by ≥ 3).
  4. All options are positive and integers (e.g. 1 × 1, 1 × 2 stay ≥ 0).
  5. Deterministic for a fixed seed (same RNG ⇒ same options).
- **Definition of Done:** test cases 1–5 pinned in `features/play/play.test.tsx` (or a new
  `lib/question.test.ts`); full gate `pnpm test && pnpm lint`.
- **Dependencies:** (none)

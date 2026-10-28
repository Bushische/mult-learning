# T45 — Distractor options per operation type

- **Goal:** wrong buttons stay plausible for every operation, not just `×`.
- **Inputs:** T43 questions, `buildOptions` (T26 table-mistake logic is `×`-only).
- **Outputs:** per-operation candidate builders: `+`/`−` proximity (`right ±1/±2/±10`, digit swaps); `×` the existing table-mistake pool; `÷` nearby quotients (`±1/±2`) plus off-by-one-dividend quotients; shared dedupe/positivity/shuffle rules unchanged.
- **Test cases:**
  1. Setup: `15 + 7` (N=3). Action: build options (fixed seed). Expected: 22 once plus plausible neighbours from `{20, 21, 23, 24, 12, 32}`.
  2. Setup: `20 − 8` (N=4). Action: build options. Expected: 12 once, all options ≥ 0, no duplicates.
  3. Setup: `20 ÷ 4` (N=3). Action: build options. Expected: 5 once, distractors are small integers near 5 (never fractions).
  4. Setup: any op, N=3..6, many seeds. Action: build options. Expected: exact count, unique, deterministic per seed.
- **Definition of Done:** cases 1–4 pinned in the question unit tests; full gate `pnpm test && pnpm lint`.
- **Dependencies:** T44

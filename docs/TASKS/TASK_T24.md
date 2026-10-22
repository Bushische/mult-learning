# T24 — Progress bar shows max / current / min earning

- **Goal:** while the countdown runs, the child sees the reward shrinking from max to min.
- **Inputs:** feedback #6. `features/play/components/CountdownBar.tsx` (bar only),
  `PlayPage.tsx` (passes `remaining`), `computeRewardSeconds` + `formatDuration` (T23/T17).
- **Outputs:** `CountdownBar` extended to take `baseTimeReward`, `questionSeconds`,
  `remaining`, `total` and render:
  - left label `min +0:00`, right label `max +<base>` (`formatDuration`);
  - the current earning value centered on the bar, decreasing as time passes
    (elapsed = `total − remaining`; value = `computeRewardSeconds(...)`);
  - a marker/segment whose position tracks `current/max` (right at start → left at timeout);
  - accessible names (`aria-label` with the three values) and test ids
    `earning-min`, `earning-max`, `earning-current`.
- **Test cases:**
  1. At `remaining = total` the current value equals the max and sits near the right edge.
  2. Halfway through a 15 s question with grace 3 s, the current value equals the T23 formula
     result (5 for base 10) and its position is between min and max.
  3. At `remaining = 0` the current value is `+0:00` at the left edge.
  4. Labels render as clock values (`+0:10` / `+0:00`), not bare seconds.
  5. The bar still shrinks with the countdown (existing behavior preserved).
- **Definition of Done:** test cases 1–5 pinned in `features/play/play.test.tsx` (fixed
  `remaining` props + timer-driven assertions); full gate `pnpm test && pnpm lint`.
- **Dependencies:** T23, T17

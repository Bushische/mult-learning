# T25 — Roll sequence with deliberate pauses

- **Goal:** the brain gets time to prepare: first number → pause → options → pause → second number.
- **Inputs:** feedback #8. `features/play/pages/PlayPage.tsx` (single `rolling` phase),
  `hooks/useSlotRoll.ts` (both numbers roll at once), `lib/constants.ts`,
  `components/SlotDisplay.tsx`, `components/AnswerButtons.tsx`.
- **Outputs:** explicit phase machine:
  `roll1` (Num 1 spins fast, ~350 ms, locks) → `pause1` (~450 ms; Num 2 shows `?`) →
  `options` (~550 ms; the N buttons fade in **disabled**) → `roll2` (Num 2 spins and
  decelerates, ~800 ms, locks) → `question` (countdown starts, buttons enabled) → `feedback`.
  Named constants for every duration in `lib/constants.ts`; timers/RAF cleaned on unmount and
  when a new question starts. The hint bubble still appears once both factors are known.
- **Test cases:**
  1. The first number locks before the options become visible (DOM order of phases, fake timers).
  2. Options are visible before the second number locks, and disabled (click does nothing,
     no `POST /answers`).
  3. The countdown does not start before `question`; no timeout can fire during the pauses.
  4. Pre-question delay is at least 2 s in total, and every pause is ≥ 300 ms.
  5. "Stop / Finish" / unmount during any pause cancels pending timers (no stray submissions).
  6. After the second number locks, options enable and the countdown starts on the same tick.
- **Definition of Done:** test cases 1–6 pinned in `features/play/play.test.tsx`; full gate
  `pnpm test && pnpm lint`.
- **Dependencies:** T24

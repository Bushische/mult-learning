# T27 — Feedback bug: "The answer was X" on a correct click

- **Goal:** a correct answer always says "Correct!", never "The answer was <the chosen value>",
  and one question accepts exactly one answer.
- **Inputs:** feedback #10. `features/play/pages/PlayPage.tsx` (`record` is async while the
  countdown keeps running; `catch { setLastCorrect(false) }`; feedback text), `hooks/useCountdown.ts`.
- **Outputs:** per-question single-submission guard (`answeredRef`/`submittingRef`): the first
  tap wins, further taps are ignored; the countdown stops immediately on tap (before the
  request resolves) so a timeout cannot race the in-flight answer; on API failure show
  `"Couldn't save your answer — try again"` (retry allowed), never a fabricated wrong-answer
  message; "The answer was N" is rendered only when a submitted answer was actually wrong
  (`chosen !== null && !correct`) and N comes from the server's `rightAnswer`.
- **Test cases:**
  1. Clicking the correct option then advancing timers past the countdown causes exactly ONE
     `POST /answers` and shows "Correct!" (regression: the race that produced "The answer was 12").
  2. Double-tapping an option in the same question submits only once.
  3. Wrong option → "The answer was <server rightAnswer>", and the bar stops before timeout.
  4. Timeout with no tap → one submission with `chosen: null` and the wrong-answer feedback.
  5. API failure (500/network) → the error message is shown; no "The answer was" text and no
     bank/attempt count update.
- **Definition of Done:** test cases 1–5 pinned in `features/play/play.test.tsx` (fake timers
  + fetch stub counting calls); full gate `pnpm test && pnpm lint`.
- **Dependencies:** T25

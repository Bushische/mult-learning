# T31 — Feedback shows the seconds won or lost

- **Goal:** after each answer the child sees exactly how many seconds were added or taken.
- **Inputs:** `apps/web/src/features/play/pages/PlayPage.tsx` (feedback paragraph, `result.timeDelta` from `POST /answers` already carries the signed delta).
- **Outputs:** feedback copy with the delta: `Correct! +9 sec` on a win, `The answer was N. −5 sec` on a miss/timeout, each with a small emoji.
- **Test cases:**
  1. Setup: fresh question, max reward 10 s. Action: answer correctly at once. Expected: feedback reads `Correct!` plus `+10 sec` and a thumbs-up.
  2. Setup: fresh question, penalty 5 s. Action: tap a wrong option. Expected: feedback shows `The answer was <server rightAnswer>` plus `−5 sec` and a disappointed face; the countdown bar has stopped.
  3. Setup: fresh question. Action: let the countdown expire with no tap. Expected: one submission with `chosen: null`, feedback shows the right answer plus `−5 sec`.
  4. Setup: answer that earns a decayed reward (e.g. late correct +5 s). Action: answer correctly near the timeout. Expected: feedback shows the actual credited `+5 sec`, matching the bank line update.
- **Definition of Done:** test cases 1–4 pinned in `apps/web/src/features/play/play.test.tsx`; full gate `pnpm test && pnpm lint`.
- **Dependencies:** T27

# T36 — Per-game cards show correct / wrong / today total

- **Goal:** each game row reads at a glance — green correct gains, red mistake losses, one today total.
- **Inputs:** `apps/web/src/features/dashboard/components/GameList.tsx` (per-game today rows), per-day per-game data (T28: `totalTries`, `correctTries`, `timeEarnedSeconds` per game per day), game `timePenalty` (wrong seconds are derived, not stored: `lost = (total − correct) × timePenalty`), the red from the wrong-answer flash, 15 s polling (T34, same query — no new wiring).
- **Outputs:** reworked game rows: a green "Correct" label with the earned seconds in a green pill; a red "Wrong" label (the wrong-flash red) with lost seconds in a pink pill; a total line `Today: +M:SS (C/T)` where `C/T` is correct out of all attempts that day.
- **Test cases:**
  1. Setup: game with 2 correct (+10 s each, penalty 5 s) and 1 wrong today. Action: open `/`. Expected: the row shows green "Correct" with `+0:20`, red "Wrong" with `−0:05`, and `Today: +0:20 (2/3)`.
  2. Setup: game with no wrong answers today. Action: open `/`. Expected: the Wrong line shows `−0:00` (still present, zeroed).
  3. Setup: unplayed game. Action: open `/`. Expected: `Today: +0:00 (0/0)`.
  4. Setup: dashboard open, child answers in another session. Action: wait 16 s. Expected: the affected game row updates without reload (T34 polling covers the new fields).
- **Definition of Done:** test cases 1–4 pinned in `dashboard.test.tsx`; full gate `pnpm test && pnpm lint`.
- **Dependencies:** T28, T30, T34

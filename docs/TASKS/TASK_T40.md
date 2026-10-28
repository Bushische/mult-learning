# T40 — Stats show average gain per turn plus separate total gain / total loss

- **Goal:** the child and the admin see not just net numbers but the pace (avg/turn) and both sides of the ledger (total +, total −).
- **Inputs:** `POST /answers` (only positive deltas are recorded today), `daily_stats` + `game_daily_stats` (no loss column), child today card + history rows, admin week Total column + user-stats header.
- **Outputs:** recorded `time_lost_seconds` (actual seconds taken from the bank, i.e. `-appliedDelta` when negative) in `daily_stats` and `game_daily_stats` (migration, upserted in the answer transaction, wiped by reset); shared schemas + endpoints expose it; UI shows: average gain per turn (`earned ÷ tries`, `+M:SS`, zeros when no tries), total gain (`+M:SS`) and total loss (`−M:SS`) next to every net figure they already show (today card, history rows, admin week Total column, admin today header).
- **Test cases:**
  1. Setup: today 3 tries / 2 correct / +20 earned / −5 taken. Action: open `/`. Expected: today card shows avg `+0:07` per turn (20 ÷ 3 rounded down), gain `+0:20`, loss `−0:05`.
  2. Setup: same day. Action: open the admin child-stats page. Expected: Total column shows net `+0:15` with gain `+0:20` and loss `−0:05`.
  3. Setup: fresh child, no tries. Action: open `/`. Expected: avg/gain/loss all zero, no crash, no NaN.
  4. Setup: answer at an empty bank (wrong, taken 0). Action: check the stats endpoints. Expected: `time_lost_seconds` grows only by what was actually taken (0), never by the nominal penalty.
  5. Setup: admin reset. Action: answer afterwards. Expected: gain/loss counters start from zero (reset wipes the new columns too).
- **Definition of Done:** test cases 1–5 pinned by API tests + dashboard/admin tests; contracts updated in the same commit; full gate `pnpm test && pnpm lint`.
- **Dependencies:** T39

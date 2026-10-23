# T35 — Dashboard header shows today's gain instead of the bank

- **Goal:** the child immediately sees what they earned today — no confusing lifetime bank next to a bigger today number.
- **Inputs:** `apps/web/src/features/dashboard/components/AppHeader.tsx` (header bank pill), `useDailyStats` (today's earned), `formatDuration`.
- **Outputs:** header pill shows today's earned time (same big-pill style as the old bank); the lifetime bank leaves the dashboard header (still visible in the play HUD and the admin stats page).
- **Test cases:**
  1. Setup: child earned 50 s today, bank holds 453 s from earlier days. Action: open `/`. Expected: the header pill reads `+0:50`; no lifetime-bank value appears in the header.
  2. Setup: fresh child, nothing played. Action: open `/`. Expected: the header pill reads `+0:00`.
  3. Setup: admin logged in. Action: open `/admin`. Expected: no header pill change there (admin views untouched).
- **Definition of Done:** test cases 1–3 pinned in `dashboard.test.tsx`; full gate `pnpm test && pnpm lint`.
- **Dependencies:** T30, T34

# T34 — Stat pages refresh on their own every 15 seconds

- **Goal:** dashboard and admin stats stay current while open — no manual refresh after someone plays.
- **Inputs:** `apps/web/src/features/dashboard/hooks/useHeatmap.ts`, `useDailyStats.ts`, `usePerGame.ts`; `apps/web/src/features/admin/hooks/useAdminData.ts` (`useLeaderboard`, `useAdminDaily`, `useAdminUserStats`, `useAdminPerGame`).
- **Outputs:** `refetchInterval: 15_000` on those seven stats queries (config lists and forms untouched — only live numbers poll).
- **Test cases:**
  1. Setup: child dashboard open showing `+0:20` today. Action: server numbers change, 16 s pass with no interaction. Expected: the today card shows the new value without any click or reload.
  2. Setup: admin child-stats page open. Action: per-game numbers change, 16 s pass. Expected: the per-game rows and totals update in place.
  3. Setup: any existing dashboard/admin test. Action: run the suite. Expected: no test needs longer waits or flakes because of the new interval.
- **Definition of Done:** test cases 1–2 pinned in `dashboard.test.tsx` / `admin.test.tsx` (fake timers); full gate `pnpm test && pnpm lint`.
- **Dependencies:** T28, T30

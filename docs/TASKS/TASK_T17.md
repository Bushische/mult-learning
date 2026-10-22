# T17 — Human-readable durations everywhere (no "+113s")

- **Goal:** earned/bank time reads like a clock (`1:53`, `1:02:05`) on every screen.
- **Inputs:** feedback #11. `apps/web/src/features/dashboard/lib/format.ts` (`formatBank`),
  its call sites: `AppHeader`, `DailyStatsCard`, `SessionSummaryCard`, `LeaderboardTable`,
  `StatsTab`, `PlayPage` HUD; tests in the matching `*.test.tsx`.
- **Outputs:** one exported `formatDuration(seconds)` in `dashboard/lib/format.ts`
  (keep `formatBank` as a thin alias or replace all call sites): `M:SS` under one hour,
  `H:MM:SS` from one hour (`113 → "1:53"`, `3725 → "1:02:05"`, `0 → "0:00"`, negative → `"0:00"`).
  Remove every `+{n}s` / `{n}s` duration string in favor of it; keep labels (`earned`, `bank`,
  `total`) but move units into the formatted value.
- **Test cases:**
  1. Formatting: 0→"0:00", 59→"0:59", 113→"1:53", 3600→"1:00:00", 3725→"1:02:05", −5→"0:00".
  2. Dashboard header bank and daily card show clock values, never a bare "Ns" number.
  3. Admin leaderboard row shows e.g. `1:53 · 83%` (no "+113s") in both tables.
  4. Admin stats tab "earned" column shows the same clock format.
  5. Session summary ("time added") and play HUD bank use the same formatter.
- **Definition of Done:** test cases 1–5 pinned by `dashboard/lib/format.test.ts` +
  component assertions in dashboard/admin/play tests; full gate `pnpm test && pnpm lint`.
- **Dependencies:** (none)

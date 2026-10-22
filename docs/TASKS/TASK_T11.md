# T11 — Dashboard: header bank, 7-day heatmap, daily stats, game selection

- **Goal:** the main screen shows bank, recent mastery colors, today's numbers, and starts games.
- **Inputs:** docs/PROJECT.md (screens B–C), docs/API.md (Games + Stats).
- **Outputs:** `features/dashboard/` replacing the `/` stub: header (user, bank `45:00`
  format via `GET /me`, logout), heatmap grid (2–10 styled columns, factor axes labeled,
  cells colored none/green/mixed/red per API buckets — pure display, math excluded),
  daily stats card (`tries vs correct`, `+Ns today`), assigned games list with economics
  (`+10s / −5s`) and a big **"Let's Play!"** per game → `/play/:gameId`.
- **Test cases:**
  1. Header shows the logged-in child's username and bank formatted `M:SS`; logout works.
  2. After seeding answers via the API, a previously-red cell renders red and turns green
     once fresh high-accuracy answers land (UI renders exactly what `GET /stats/heatmap` returns).
  3. Cells with no data render neutral gray with "no tries" tooltip/aria.
  4. Daily card shows today's tries/correct compared with what `GET /stats/daily` returns.
  5. Each assigned game shows its name + `+10s correct / −5s wrong` and navigates to
     `/play/:gameId`; unassigned games never appear.
  6. Answering inside the play stub then returning updates the heatmap + daily card
     (TanStack invalidations).
- **Definition of Done:** Test cases 1–4 pinned by `features/dashboard/*.test.tsx`
  (feature-level renders with stubs); full gate `pnpm test && pnpm lint`.
- **Dependencies:** T10, T5, T6

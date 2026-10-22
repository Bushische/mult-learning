# T19 — Leaderboard names link to the child's stats page

- **Goal:** an admin taps a child's name on either leaderboard and lands on that child's page.
- **Inputs:** feedback #2. `LeaderboardTable.tsx`, `AdminPage.tsx`, `App.tsx` routes,
  `features/admin/api.ts` + `useAdminData.ts` (user list already fetched).
- **Outputs:** child names in BOTH leaderboard tables are links to
  `/admin/users/:id/stats`; new route (admin-only, protected like `/admin`) registering
  `features/admin/pages/UserStatsPage.tsx`. The page shell shows the child's username,
  current bank, assigned games, a "Back to admin" link, and `data-testid` placeholders
  `heatmap` / `week-summary` for T20 to fill. Unknown user id → "User not found" message.
- **Test cases:**
  1. Clicking a name in the today table navigates to `/admin/users/<id>/stats`.
  2. Same for the 7-day table.
  3. A deep link renders that child's name + bank; the back link returns to `/admin`.
  4. Unknown id renders "User not found" (no crash).
  5. A logged-out visit redirects to `/login`; a child token redirects out (no admin data).
- **Definition of Done:** test cases 1–5 pinned by `features/admin/admin.test.tsx`
  (router harness); full gate `pnpm test && pnpm lint`.
- **Dependencies:** T18

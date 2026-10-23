# T29 — Jump to child stats from User management

- **Goal:** from the admin Users tab the admin can open a child's stats page in one tap.
- **Inputs:** `apps/web/src/features/admin/components/UsersTab.tsx`, `apps/web/src/features/admin/components/UserRow.tsx`, route `/admin/users/:id/stats` (`apps/web/src/App.tsx`).
- **Outputs:** username (or a stats button) in each user row linking to that user's stats page.
- **Test cases:**
  1. Setup: admin on the Users tab with two children. Action: tap the first child's name. Expected: the child-stats page opens showing that child's name and bank.
  2. Setup: on a child-stats page reached from Users. Action: tap "Back to admin". Expected: the admin panel is shown again.
  3. Setup: signed in as a non-admin. Action: open `/admin`. Expected: redirect away from the admin panel (no user list visible).
- **Definition of Done:** test cases 1–3 pinned in `apps/web/src/features/admin/` tests; full gate `pnpm test && pnpm lint`.
- **Dependencies:** T27

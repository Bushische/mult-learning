# T13 — Admin panel: leaderboard, users management, stats + reset

- **Goal:** parents run the family from `/admin` (guarded, admin-only).
- **Inputs:** docs/PROJECT.md (screen F), docs/API.md (Admin).
- **Outputs:** `features/admin/` with tabs: **Dashboard** — leaderboard table (7-day
  `+time / accuracy` per child); **Users** — create/edit child or admin (name, PIN, role),
  assign games (checkbox list seeded from games), delete (with confirm + last-admin guard);
  **Stats** — per-user 7-day heatmap switcher + daily log table; red **"Reset Progress / Heatmap"**
  button per user (2-step confirm → POST /admin/users/:id/reset).
- **Test cases:**
  1. `/admin` as a child or logged-out user redirects to `/login` (server 403 → client guard).
  2. Admin creates "child2" with a PIN; child2 logs in on the login grid immediately after.
  3. Assigning two games to child2 via checkboxes reflects in PUT then in child2's own games.
  4. Editing child2's PIN invalidates the old session on child2's ACCESS-attempt (401) and the
     new PIN logs in.
  5. Leaderboard orders child1 above child2 exactly per GET /admin/leaderboard
     (numbers rendered as `+45s · 83%`).
  6. Reset on child1 wipes their bank to 0 in the UI and their daily card back to fresh —
     confirmed by the confirm dialog appearing first.
- **Definition of Done:** Test cases 1–6 pinned by `features/admin/*.test.tsx`; full gate
  `pnpm test && pnpm lint`.
- **Dependencies:** T10, T8, T9

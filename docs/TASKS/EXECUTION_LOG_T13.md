# Execution Log — T13 — Admin panel: leaderboard, users management, stats + reset

- Task: T13
- Status: DONE
- Date: 2026-10-22
- Commit: 73194b8
- Model: opencode/minimax-m3.1-flash-free

## Notes
- `/admin` is guarded client-side: a non-admin (or a logged-out visitor) is redirected to
  `/login` (the api answers 403 for a child anyway).
- The "per-user 7-day heatmap" of the stats tab is rendered as the per-child daily log
  (`GET /admin/stats/daily` + a user switcher) — the api has no endpoint for another user's
  heatmap and the contract was not changed.
- The reset needs a 2-step confirmation (the confirm dialog appears first).
- The api-client was extended with pattern matching for stub routes (`/admin/users/:id/...`).

## Session notes
- 2026-10-22 | T13 | opencode/minimax-m3.1-flash-free | Added the admin panel (leaderboard, user CRUD + game assignment, delete/reset confirmations, daily log + user switcher); 6 admin tests green.

# Execution Log — T8 — Admin: users CRUD, PIN management, game assignments, progress reset

- Task: T8
- Status: DONE
- Date: 2026-10-22
- Commit: 078f591
- Model: opencode/minimax-m3.1-flash-free

## Notes
- Access tokens are signed with a per-user secret derived from the PIN hash, so changing a
  PIN invalidates the old session (JWT payload stays `{ sub, role }` per docs/API.md).
  Changing a PIN also deletes that user's refresh tokens.
- `DELETE /admin/users/:id` refuses to remove the last admin (409 CONFLICT).
- Reset (matrix_stats + daily_stats wipe, bank → 0) runs in one transaction.

## Session notes
- 2026-10-22 | T8 | opencode/minimax-m3.1-flash-free | Added admin users API (list/create/patch/delete, PUT games, POST reset) behind requireAdmin + PIN-derived token invalidation; 8 tests green.

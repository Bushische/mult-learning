# T8 — Admin: users CRUD, PIN management, game assignments, progress reset

- **Goal:** admins fully manage the family's accounts and apply resets.
- **Inputs:** docs/API.md (Admin section rows 1–6), docs/DATA_MODEL.md.
- **Outputs:** `src/routes/admin/users.ts` (+ services): `GET/POST /admin/users`,
  `PATCH/DELETE /admin/users/:id` (username/PIN/role edits; duplicate username → 409;
  deleting the last admin → 409), `PUT /admin/users/:id/games` (replace assignment set),
  `POST /admin/users/:id/reset` (transactional: delete matrix_stats + daily_stats rows,
  bank → 0). All behind `requireAdmin` (fresh DB role read).
- **Test cases:**
  1. Admin creates a child with a 4-digit PIN; the child can immediately log in with it.
  2. Duplicate username → 409 CONFLICT (created and updated).
  3. Child token on any /admin endpoint → 403; no token → 401.
  4. Admin sets a new PIN via PATCH; the old PIN stops working, the new one works.
  5. PUT assignments replaces the set: add game B, remove game A — visible in the child's
     next games fetch.
  6. Reset zeroes the bank and removes daily/heatmap data — further `POST /answers` start
     from a clean slate; `GET /stats/daily` shows zeros.
  7. onDelete cascades: DELETE user removes their assignments + stats without orphans.
- **Definition of Done:** Test cases 1–7 pinned by `apps/api/src/routes/admin/users.test.ts`;
  full gate `pnpm test && pnpm lint`.
- **Dependencies:** T4

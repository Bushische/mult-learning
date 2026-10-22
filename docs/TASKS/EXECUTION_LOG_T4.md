# Execution Log — T4 — Auth: PIN login, refresh rotation, /me, login grid

- Task: T4
- Status: DONE
- Date: 2026-10-22
- Commit: e18a176
- Model: opencode/minimax-m3.1-flash-free

## Notes
- DEVIATION: `refresh_tokens` table added (user_id, token_hash sha256, expires_at,
  created_at) — docs/DATA_MODEL.md defines only the 5 contract tables and has no place
  for the "sha256 hash in DB" required by docs/API.md. The contract file was NOT modified.
- Refresh cookie: HttpOnly + SameSite=Strict + Path=/api/auth always; `Secure` only when
  NODE_ENV=production (a Secure cookie would be dropped on plain http on the LAN).
- `vitest.config.ts` aliases `packages/shared` → `packages/shared/src/index.ts`: with pnpm's
  isolated store vite could not resolve `zod` from the linked workspace package.
- Access tokens: JWT `{ sub, role }`, 15 min; `requireAdmin` re-reads the users row.

## Session notes
- 2026-10-22 | T4 | opencode/minimax-m3.1-flash-free | Added PIN login (bcrypt), JWT access + rotating sha256 refresh cookie, /api/users, /api/me, requireAuth/requireAdmin; 7 auth tests green.

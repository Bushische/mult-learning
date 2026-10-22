# T4 — Auth: PIN login, refresh rotation, /me, login grid

- **Goal:** children and admins can log in with username + PIN and stay logged in.
- **Inputs:** docs/API.md (Sessions section, verbatim), docs/DATA_MODEL.md (users).
- **Outputs:** `src/services/userService.ts`, `src/routes/auth.ts` + `users.ts`:
  `GET /users` (public, `[{id, username}]`), `POST /auth/login`, `POST /auth/refresh`
  (rotates cookie), `POST /auth/logout`, `GET /me`. JWT access 15 min `{sub, role}`;
  refresh cookie 30 d HttpOnly/Secure/SameSite=Strict/Path=/api/auth, sha256 hash in DB;
  bcrypt for PINs. `src/plugins/auth.ts` (requireAuth + requireAdmin reading the users row fresh).
- **Test cases:**
  1. Login with seeded admin credentials returns accessToken + role admin + refresh cookie.
  2. Wrong PIN → 401 `{error:{code:"UNAUTHORIZED"}}`; no cookie set.
  3. `GET /users` without auth lists usernames but exposes NO pins, roles, or banks.
  4. `GET /me` with an expired/invalid token → 401; with valid token → username + timeBankSeconds.
  5. An admin-guarded route (test stub) with a child token → 403 FORBIDDEN.
  6. Refresh issues a NEW cookie; the old cookie stops working (rotation).
- **Definition of Done:** Test cases 1–6 pinned by `apps/api/src/routes/auth.test.ts` +
  guard tests; every endpoint ≥ happy path + 1 failure case; full gate `pnpm test && pnpm lint`.
- **Dependencies:** T3

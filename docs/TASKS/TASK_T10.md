# T10 — Web bootstrap: Vite/React/Tailwind app shell + login grid

- **Goal:** the web app runs in Docker, proxies /api, and children can log into it.
- **Inputs:** docs/PROJECT.md (screens A–C), docs/API.md (Sessions), docs/CONVENTIONS.md
  (frontend rules), ARCHITECTURE.md (web container).
- **Outputs:** `apps/web` real app: Vite + React 18 + TS + Tailwind; `src/lib/api-client.ts`
  (Bearer from memory, single-flight `/auth/refresh` retry on 401); `src/stores/auth-store.ts`
  (Zustand: token + user, cleared on logout); `dev-server.mjs` (WEB_PORT, `/api` proxy to
  `api:PORT` — the compose command already expects it) + package scripts (dev/build/test);
  react-router routes: `/login`, `/` (dashboard stub), `/play/:gameId` stub, `/admin` stub
  (guarded → redirect to `/login` when no token); login feature: user grid from `GET /users`,
  PIN pad from shared zod schemas → `POST /auth/login`.
- **Test cases:**
  1. `/login` lists the seeded usernames as tappable ≥40 px tiles.
  2. Tapping a user opens the PIN entry; a wrong PIN shows an inline error and stays;
     the correct PIN lands on `/` with the username + bank in the header.
  3. Reload with a fresh session (`/auth/refresh`) keeps the child logged in — no re-login
     (silent refresh on app open).
  4. Visiting `/admin` unauthenticated redirects to `/login`.
  5. Logout clears state and returns to `/login`; time bank shows via `GET /me` in the header.
- **Definition of Done:** Test cases 1, 2, 4 pinned by `apps/web/src/features/**/*.test.tsx`
  (testing-library + MSWT-free — build api-client with a fetch stub); full gate
  `pnpm test && pnpm lint`; `docker compose up` shows the UI on :5173 (manual check).
- **Dependencies:** T6, T4

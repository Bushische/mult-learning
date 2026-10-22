# Execution Log — T10 — Web bootstrap: Vite/React/Tailwind app shell + login grid

- Task: T10
- Status: DONE
- Date: 2026-10-22
- Commit: 15581e9
- Model: opencode/minimax-m3.1-flash-free

## Notes
- The web app imports the shared contracts from source (`packages/shared` alias in
  vite.config.ts + root vitest.config.ts) — no build step needed for the contracts.
- `src/dev-server.mjs` starts Vite programmatically; the `/api` proxy is configured in
  vite.config.ts (API_HOST / API_PORT / WEB_PORT).
- The access token lives in a Zustand store (memory only); a 401 triggers one single-flight
  `/auth/refresh` + one retry.
- Dev container command installs pnpm inside the container (the repo root is mounted so the
  pnpm workspace links stay valid).

## Session notes
- 2026-10-22 | T10 | opencode/minimax-m3.1-flash-free | Bootstrapped apps/web (Vite+React+Tailwind, api-client with silent refresh, auth store, login grid + PIN pad, protected routes); 5 web tests green.

# T15 — PWA: installable, offline app shell, silent auth persistence

- **Goal:** the app behaves like a native tablet app — install to home screen, instant open
  shell without re-login.
- **Inputs:** docs/PROJECT.md (PWA vision), docs/ARCHITECTURE.md (frontend build).
- **Outputs:** `vite-plugin-pwa` wired: web manifest (name, icons ≥192/512, standalone,
  landscape+portrait); service worker precaching the built shell; `/api` fetches stay
  network-only (graceful "you are offline" state instead of data cache); install prompt UI
  point; app icon set; `virtual:pwa-register/react` import behind the same alias the root
  `vitest.config.ts` resolves (`apps/web/src/test/pwa-register-stub.ts` for tests).
- **Test cases:**
  1. Built bundle has a valid manifest + registered SW (registerSW fires in prod build;
     stubbed in tests).
  2. Login → reload within 30 d never re-asks for PIN (refresh cookie behavior already built;
     asserted via api-client silent refresh path).
  3. A test component consuming `virtual:pwa-register/react` runs under root vitest without a
     bundler plugin (alias works).
  4. /api calls never hit the SW cache offline (error state surface, not stale data).
- **Definition of Done:** Test cases 3–4 pinned by web tests; cases 1–2 verified on the
  built preview via a scripted check documented in the log; full gate `pnpm test && pnpm lint`.
- **Dependencies:** T10

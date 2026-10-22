# Execution Log — T15 — PWA: installable, offline app shell, silent auth persistence

- Task: T15
- Status: DONE
- Date: 2026-10-22
- Commit: 1d15daf
- Model: opencode/minimax-m3.1-flash-free

## Notes
- `vite-plugin-pwa@1.3` (v2 dropped the `registerSW` export): manifest with 192/512 icons,
  standalone + orientation "any", the app shell is precached (12 entries) and `/api` is
  `NetworkOnly` (`src/pwa/runtime-caching.ts`).
- The app registers the worker itself through `virtual:pwa-register/react`
  (`useRegisterSW`); the root `vitest.config.ts` aliases that module (and
  `virtual:pwa-register`) to `apps/web/src/test/pwa-register-stub.ts`.
- The icons are generated without image tooling: `scripts/generate-icons.mjs` writes real
  PNGs (192/512) into `apps/web/public/icons/`.
- Case 1 (built bundle) + case 2 (silent refresh) verified with the scripted check:
  `pnpm check:pwa` → `PWA CHECK: ok — manifest, icons and service worker are in place`
  (manifest fields, both icons reachable, `sw.js` contains `NetworkOnly` + `precacheAndRoute`,
  the bundle registers the worker). The silent refresh path is pinned by the T10 login test
  ("a fresh session is restored silently via /auth/refresh").
- The dashboard shows an explicit offline banner instead of stale data.

## Session notes
- 2026-10-22 | T15 | opencode/minimax-m3.1-flash-free | Wired vite-plugin-pwa (manifest, icons, precached shell, NetworkOnly /api), install prompt, pwa-register stub alias + 3 pwa tests; build check green.

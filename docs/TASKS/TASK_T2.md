# T2 — API bootstrap: Fastify app, config, error handler, /health

- **Goal:** api service runs in Docker and answers /health with a centralized error contract.
- **Inputs:** docs/API.md (error shape), docs/ARCHITECTURE.md, docs/CONTEXT.md commands.
- **Outputs:** `apps/api/package.json` (dev/start/test scripts, `node --watch` + tsx),
  `src/config.ts` (zod-validated env: NODE_ENV, HOST, PORT, LOG_LEVEL, JWT_SECRET,
  DATABASE_PATH), `src/app.ts` + `src/index.ts`, `src/dev-server.mjs` (commanded by docker
  compose), `src/errors.ts` + `src/plugins/error-handler.ts` (FastifyHttpError →
  `{"error":{"code","message"}}`, VALIDATION_ERROR from zod failures, NOT_FOUND for unknown
  routes), pino logging to stdout; root `pnpm --filter api dev` works outside Docker too.
- **Test cases:**
  1. `GET /health` without auth returns 200 `{"status":"ok"}`.
  2. Unknown route `GET /api/nope` returns 404 with body `{error:{code:"NOT_FOUND",...}}`.
  3. A route throwing `FastifyHttpError(409, "CONFLICT", "...")` maps to 409 + that body
     (provable via a temporary test-only route).
  4. Wrong env (missing PORT) fails config validation at boot with a readable error.
- **Definition of Done:** Test cases 1–4 pinned by `apps/api/src/*.test.ts` (Fastify inject);
  full gate `pnpm test && pnpm lint`; `docker compose up api` boots the real app —
  manual check, not a test.
- **Dependencies:** T1

# PROJECT_LEARNING.md — Mult Learning, file by file

<!-- TEMPLATE: a deep "read the codebase in N minutes" walkthrough, written AFTER
     the first milestones land. The canonical structure (from the reference project):

## Phase 1 — Tooling and contracts (read these before any code)
- Step 1. Root configs — package.json, pnpm-workspace.yaml, tsconfig.base.json, biome.json, vitest.config.ts
- Step 2. Environment and Docker — .env.example, docker-compose.yml, docker-compose.override.yml
- Step 3. The contract package — packages/shared/src/index.ts

## Phase 2 — Backend (apps/api/)
- Step 4. Config — src/config.ts
- Step 5. Database — src/db/{schema,client,migrate}.ts, drizzle.config.ts, drizzle/, scripts/seed.ts
- Step 6. Fastify plugins — src/plugins/{db,error-handler,auth}.ts, errors.ts
- Step 7. Services (pure domain logic) — src/services/*.ts
- Step 8. Routes (HTTP adapters) — src/routes/*.ts
- Step 9. App wiring — app.ts, index.ts, dev-server.mjs

## Phase 3 — Frontend (apps/web/)
- Step 10. Build and shell — vite.config.ts, index.html, src/{main,app}.tsx, src/index.css
- Step 11. Transport — src/lib/api-client.ts, src/stores/auth-store.ts
- Step 12. Server-state pattern — one feature end to end
- Step 13. The main screen (biggest feature — read selectively)
- Step 14. Remaining features

## Phase 4 — Delivery and quality
- Step 15. Prod delivery — Dockerfiles, nginx.conf, docker-compose.prod.yml
- Step 16. Tests, types, docs — *.test.ts(x), docs/

## Appendices
- A. Library cheat-sheet (what + why + where, not just names)
- B. Suggested reading order (checklist)
- C. Glossary (BE → FE translations)

Fill each step with the REAL files and their "why", per folder, per pattern. -->

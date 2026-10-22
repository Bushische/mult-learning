# Conventions

## TypeScript
- strict mode; no `any`, no `@ts-ignore`.
- Use **zod** for runtime validation on every endpoint (input + output).
- DTO types and zod schemas live in `packages/shared`; both apps import from there.
- IDs: `@paralleldrive/cuid2`.

## Monorepo
- pnpm workspaces: `apps/api`, `apps/web`, `packages/shared`.
- Scripts via filters: `pnpm --filter api dev`, `pnpm --filter web build`, root `pnpm test`, `pnpm lint`.
- Lint/format: **Biome** (`biome.json` at root).

## Backend (Fastify + Drizzle + better-sqlite3)
- One router file per resource: `src/routes/<resource>.ts`.
- Service layer: `src/services/<resource>Service.ts` — routes stay thin
  (validate → call service → serialize).
- Errors: throw `FastifyHttpError(status, code, message)`; centralized error handler maps to
  `{ "error": { "code", "message" } }`. Codes (docs/API.md): VALIDATION_ERROR 400,
  UNAUTHORIZED 401, FORBIDDEN 403, NOT_FOUND 404, CONFLICT 409.
- Public endpoints (only these): `/health`, `GET /users` (login grid, id + username only),
  `/auth/login`, `/auth/refresh`, `/auth/logout`. Everything else requires auth;
  `/admin/*` requires `requireAdmin` (re-reads the users row fresh).
- All DB access via Drizzle; **no raw SQL except pragmas and `.backup`**.
- Multi-row updates (admin reset, cascade deletes) run inside one `db.transaction`.
- Game/answer business rules (time bank clamp, correctness, stats upsert) live in the service
  layer and are computed server-side only.
- Migrations: `drizzle-kit` (`pnpm --filter api db:generate` / `db:migrate`); never edit the DB by hand.
- Logging: pino to stdout (visible via `docker logs`).
- Config from env (`PORT`, `JWT_SECRET`, `DATABASE_PATH`); validated by zod at boot.

## SQLite specifics
- Tests run on in-memory SQLite (`:memory:`); migrations applied before each suite.
- Always rely on the pragmas from docs/ARCHITECTURE.md (set once in the db module).
- Store time as integer seconds; timestamps as unix epoch (`timestamp` mode); booleans as
  `integer({ mode: "boolean" })`; daily rows keyed by `YYYY-MM-DD` (UTC).

## Frontend (React + Vite)
- Feature folders: `src/features/<feature>/{api,hooks,components,pages}`.
- TanStack Query keys: `["me"]`, `["games"]`, `["heatmap"]`, `["daily"]`, `["admin","users"]`,
  `["admin","games"]`, `["admin","leaderboard"]` …
- Forms: react-hook-form + zod (schemas imported from `packages/shared`).
- Access token in memory (Zustand); on `401` run a single-flight `/auth/refresh` and retry once.
- Optimistic updates via TanStack Query `onMutate` where the UX benefits (none for answers —
  the score/countdown feedback relies on the authoritative server response).
- Mobile-first: touch targets > 40 px; answer buttons randomize positions per question;
  animations (slot-machine roll, countdown bar) are CSS/JS-feature code only — the API never
  knows about timing.
- All text i18n-ready (English for v1).

## Git
- Conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.
- Solo workflow on `main`: exactly **one commit per task**, made by the orchestrator
  (`scripts/run-next-task.sh`) only after `pnpm test && pnpm lint` pass.
- The executing agent never runs `git commit` and never creates branches.
- **Exception — single-session mode** (`./scripts/run-next-task.sh --single-session`,
  prompt in docs/SINGLE_SESSION_PROMPT.md): there is no per-task orchestrator, so the agent
  makes the per-task commit itself (`feat(Tn): title`), stamps its own sha into the task's
  `- Commit:` log line and amends that same commit. Still exactly one commit per task,
  never pushed, never a branch.

## Tests
- Backend: vitest + supertest (Fastify `inject`); every endpoint ≥ happy path + 1 auth-failure case.
- Frontend: vitest + @testing-library/react; only critical flows (login, answer loop, heatmap).
- `pnpm test && pnpm lint` must pass before merging any task.

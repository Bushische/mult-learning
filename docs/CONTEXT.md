# CONTEXT.md — task-agent digest

> Single file to read INSTEAD of PROJECT/ARCHITECTURE/CONVENTIONS (they are distilled here).
> The contracts (docs/DATA_MODEL.md, docs/API.md) remain authoritative — read them only when
> the task touches API shapes, DB schema, or endpoint behavior. The product goal lives in
> docs/TASK.md + docs/TASK_DEVELOPMENT_PLAN.md.
> **Maintenance:** when PROJECT/ARCHITECTURE/CONVENTIONS change, update this digest in the
> same commit.

## What this is
Self-hosted gamified multiplication-learning PWA: children earn screen-time seconds by
answering `a × b` questions (speed + accuracy), admins control difficulty, time economics,
and see rolling-7-day heatmaps. For the Synology DS223j (ARM64, 1 GB RAM). Developed on the
laptop, no CI/CD. Vision: docs/TASK.md; screens: docs/PROJECT.md.

## Repo layout (pnpm workspaces)
- `apps/api` — Fastify + TypeScript + Drizzle ORM + better-sqlite3 (SQLite in-process, WAL).
  Complete: config, error contract, db layer, auth, games, answers, stats, admin routes.
- `apps/web` — React 18 + Vite + TS; Tailwind; TanStack Query v5; Zustand; PWA via
  `vite-plugin-pwa`. Complete: login, dashboard, play loop, admin panel, game studio.
- `packages/shared` — zod schemas + DTO types (both apps import; the ONLY place for shared
  types). The npm package name is `@mult/shared` (a slash in a bare specifier breaks the
  Node ESM resolver); the folder stays `packages/shared/`.
- `docker-compose.yml` (dev; api + web). `docker-compose.override.yml` → `./local-data`.
- `docker-compose.prod.yml` (prod: api 128m + nginx web 32m, port 8080).

## Commands
- `pnpm install` / `pnpm lint` (Biome) / `pnpm test` (vitest, root run covers all packages).
- Targeted tests: `pnpm vitest run <file>`. Dev: `pnpm --filter api dev`, `pnpm --filter web dev`.
- db: `pnpm --filter api db:generate|db:migrate|db:seed` (seed: admin `admin`/1289 +
  demo child `child1`/2468 + 2 games).
- deploy: `scripts/build-images.sh` (arm64 images), `scripts/deploy.sh [--nas host|--seed|--smoke]`,
  `scripts/smoke.sh`, `scripts/backup.sh`; `pnpm check:pwa` (built PWA check), `pnpm icons`.

## Non-negotiable constraints
- RAM budget: containers < 150 MB total (api 128m, web 32m). No db server ever. Cold start < 5 s.
- Strict TS, no `any`; zod validation at every endpoint boundary (input + output).
- Time = integer seconds everywhere; dates = `YYYY-MM-DD` (UTC) for daily rows; timestamps =
  unix epoch (ISO 8601 on the wire when a timestamp is returned).
- IDs = cuid2. Activity writes happen ONLY server-side in `POST /answers`.

## Backend rules
- One router per resource (`src/routes/<res>.ts`, thin: validate → service → serialize) +
  service layer (`src/services/<res>Service.ts`). Multi-row writes (reset, cascade) in one
  `db.transaction`.
- Errors: `FastifyHttpError(status, code, message)` → `{ "error": { "code", "message" } }`;
  codes: VALIDATION_ERROR 400, UNAUTHORIZED 401, FORBIDDEN 403, NOT_FOUND 404, CONFLICT 409.
- Auth: bcrypt-hashed 4-digit PIN; access JWT 15 min (`{ sub, role }`, signed with
  HMAC(jwtSecret, user.pin_hash) → a PIN change invalidates old sessions) + refresh cookie 30 d
  (`HttpOnly`, `SameSite=Strict`, `Path=/api/auth`, `Secure` in production, rotated,
  sha256-hashed in the `refresh_tokens` table).
- Public: `/health`, `GET /users` (login grid), `/auth/login|refresh|logout`. All other
  endpoints require auth; `/admin/*` requires `requireAdmin` (re-reads the users row fresh).

## Domain rules (short)
- Time bank: `users.time_bank_seconds`, clamped [0, game `max_daily_time`]; correct =
  `chosen === a*b` (`chosen: null` = timeout = wrong). Surplus above cap: stats count, bank doesn't.
- Heatmap: rolling last-7-day window over `matrix_stats` per (a,b); buckets none/green(≥0.8)/
  mixed(0.5–0.8)/red(<0.5).
- Games: factor ranges 1..20 (min ≤ max), optional `allowed_combinations_json`, 3..6 answer
  variants, `hints_json` magic-rule list.
- Admin reset = transactional delete of the user's `matrix_stats` + `daily_stats`, bank → 0.

## Frontend rules
- Feature folders: `src/features/<feature>/{api,hooks,components,pages}`.
- TanStack Query keys: `["me"]`, `["games"]`, `["heatmap"]`, `["daily"]`, `["admin","users"]`,
  `["admin","leaderboard"]` …; invalidations: answers → `["me"]` `["daily"]` `["heatmap"]`.
- Forms: react-hook-form + zodResolver over schemas from `packages/shared`.
- Access token in memory only (Zustand); on 401 → single-flight `/auth/refresh` → retry once.
- Mobile-first: touch targets > 40 px, big buttons, randomized-position answer buttons; the
  slot-machine roll and countdown timing live in the play feature (T12), never in the API.

## Testing
- api: vitest + Fastify `inject` on in-memory SQLite (`:memory:`), migrations per suite;
  every endpoint ≥ happy path + 1 auth-failure case.
- web: vitest + @testing-library/react for critical flows only (login, answer loop, heatmap).
- Gate: `pnpm test && pnpm lint` (or `scripts/verify.sh`) must pass; orchestrator commits.

## Workflow (the loop)
- One task per fresh agent session; agent never commits/branches — the orchestrator
  (`scripts/run-next-task.sh`) verifies then makes exactly one commit `feat(Tn): title`.
- Agent context budget: read docs/CONTEXT.md + its own `docs/TASKS/TASK_<ID>.md`; contracts
  (DATA_MODEL/API.md) only when the task touches API/DB shapes; another task's
  `docs/TASKS/EXECUTION_LOG_<ID>.md` only to check a dependency's result. Never scan the
  docs/TASKS/ directory.
- Agent updates ONLY its own `docs/TASKS/EXECUTION_LOG_<ID>.md` (status, date, one ≤200-char
  note); the orchestrator stamps `- Commit:` after its one commit.
- Queue: first non-DONE spec in `docs/TASKS/` (version-sorted ID order, `BLOCKED` skipped);
  `PENDING` = spec exists with no log file yet.
- **Single-session mode** (`./scripts/run-next-task.sh --single-session`, prompt:
  docs/SINGLE_SESSION_PROMPT.md): ONE agent session executes the whole queue — it reads the
  digest/contracts/specs once (attached via `-f`), keeps a scratchpad in
  `local-data/session-state.md` for compaction, runs the gate after every task, and commits
  per task itself (`feat(Tn): title` + `- Commit:` stamp + amend). The orchestrator only
  runs the session and re-verifies the final tree.
- Verify cheaply during the edit loop (touched files only), full gate once at the end.

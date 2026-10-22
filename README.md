# Mult Learning

A lightweight self-hosted **gamified multiplication-learning PWA**: children turn math
speed + accuracy into screen-time privileges; parents/admins control difficulty,
time economics, and see rolling 7-day heatmaps. Built for a **Synology DS223j**
(ARM64, 1 GB RAM) via Docker — SQLite in-process, no db server.

Development happens **on the laptop**; the codebase is built task-by-task with
fresh [opencode](https://opencode.ai) agent sessions.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 18 + TypeScript + Vite, Tailwind CSS, TanStack Query + Zustand, PWA |
| Backend | Node.js 20 + Fastify + TypeScript, zod |
| ORM / DB | **Drizzle ORM** + **SQLite** (`better-sqlite3`, WAL) — in-process, < 5 MB RAM |
| Auth | bcrypt-hashed PIN, JWT access (15 min) + rotating refresh cookie (30 d) |
| Deploy | Docker Compose (`api`, `web`), arm64 images built locally |

Why SQLite instead of a "real" DB server: the DS223j has 1 GB RAM shared with DSM;
a separate database would eat ~50–120 MB idle. SQLite in-process keeps the total
container budget under 150 MB.

## Documentation

- **Goal:** `docs/TASK.md` (charter) + `docs/TASK_DEVELOPMENT_PLAN.md` (screens & phases).
- **Specs for humans and agents:** start at `docs/PROJECT.md`, then `docs/ARCHITECTURE.md`.
- **Contracts:** `docs/API.md` and `docs/DATA_MODEL.md` are normative — agents must follow them
  verbatim; changes belong to the task that owns them.
- **Working on a task?** Read `docs/EXECUTION_PROMPT.md` first; it wires the whole context together.
- **User view:** `docs/OVERVIEW.md`.

## Task engine (AI-driven development)

One spec per task lives in `docs/TASKS/` (`TASK_<ID>.md`); each executed task gets its own
log (`EXECUTION_LOG_<ID>.md`: status, date, **commit**, summary of changes).

```bash
./scripts/run-next-task.sh          # execute the next PENDING task
./scripts/run-next-task.sh --list   # show the queue with statuses
./scripts/run-next-task.sh T1       # (re)execute a specific task
./scripts/run-next-task.sh --loop   # chain agents until failure or all tasks DONE
./scripts/run-next-task.sh --model <id>   # any opencode model id
```

Each task: fresh agent session → implementation → verified gate (`pnpm install`, `pnpm lint`,
`pnpm test`, log integrity) → exactly **one commit** (`feat(Tn): title`). The agent never
commits; the orchestrator does. `docs/TASKS/EXECUTION_LOG_<ID>.md` tracks status/date/commit
and a one-line summary of changes.

Requires: `opencode` CLI, pnpm (`corepack enable`), Docker. Task-writing workflow lives in
`docs/TASKS/README.md`; the two opencode skills are `task-create` (spec authoring) and
`task-run` (implement exactly one task).

## Roadmap

16 tasks in 4 phases — see the specs in `docs/TASKS/` for each Definition of Done:

1. **Phase A — Contracts & API foundation (T1–T5):** shared zod contracts, Fastify bootstrap,
   SQLite schema + seed, PIN auth, games read API.
2. **Phase B — Game loop & stats (T6–T9):** answer submission (time bank + stats), rolling
   7-day heatmap + daily stats, admin users/assignments, admin games/leaderboard.
3. **Phase C — Frontend (T10–T15):** web bootstrap + login grid, dashboard + heatmap,
   slot-machine play screen, admin panel, game studio, PWA.
4. **Phase D — Deployment (T16):** arm64 Dockerfiles, prod compose, Synology runbook + smoke tests.

## Dev environment (Docker)

```bash
cp .env.example .env       # set JWT_SECRET (see .env flow below)
docker compose up          # boots api (:3000) + web (:5173, proxies /api)
```

Volumes persist the SQLite DB (`/data/app.db`, dev override → `./local-data/`). See
`docs/LOCAL_DOCKER.md`.

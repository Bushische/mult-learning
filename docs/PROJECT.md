# Mult Learning — Project Spec

## Vision
A lightweight self-hosted multi-user **gamified arithmetic-learning PWA**. Children earn
**screen-time privileges** by answering `+ − × ÷` questions with speed and accuracy;
parents/admins keep full control over difficulty, time economics, and progress tracking.
Hosted on a Synology DS223j (ARM64, 1 GB RAM) via Docker, exposed through Synology
Container Manager. Development happens on the laptop, orchestrated task-by-task with opencode;
images are built locally (no CI/CD).

The web app is touch-first for tablets/phones (iPads, Android); the PWA keeps one login
per child and works as smooth offline shell on the home network.

## Stack summary
| Layer | Choice |
|---|---|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS |
| State/data | TanStack Query v5 + Zustand (access token in memory) |
| Backend | Node.js 20 + Fastify + TypeScript |
| ORM | **Drizzle ORM** (lightweight, type-safe) |
| DB | **SQLite** file via `better-sqlite3` (WAL mode) — in-process, no db container |
| Auth | bcrypt-hashed PIN + JWT access (15 min) + rotated refresh cookie (30 d) |
| Containers | Docker Compose: `api`, `web` (dev: node dev servers; prod: web via nginx) |

## UX (touch-first, per docs/TASK.md + docs/TASK_DEVELOPMENT_PLAN.md)

### A. Login / profile switcher (public)
- Clean grid of user names. Tap a user → enter their 4-digit PIN → logged in instantly.
- Wrong PIN: inline error, no lockout (home device).

### B. Game selection
- Lists all games assigned to the logged-in child: **Game Name** + economics
  (`+10s correct / -5s wrong`) with a prominent **"Start Playing"**.
- Multi-select support (a child may have several games); each has its own ranges.

### C. Dashboard (main screen)
- **Header:** user name, time bank `45:00 available`, logout.
- **Rolling 7-day heatmap:** one grid section per operation (`+ − × ÷`) over the game's
  combinations. `green` accuracy ≥ 0.8,
  `mixed` 0.5–0.8, `red` < 0.5, `gray` no data. Old errors age out after 7 days —
  recent mastery shows; errors are never permanent.
- **Daily stats card:** tries vs. correct today, time earned today.
- **Action area:** big **"Let's Play!"** button (launches the assigned game / selection).

### D. Game play screen (core loop)
1. Top HUD: shrinking countdown progress bar + live time-bank ticker.
2. Center: `[ Num 1 ] ⟨+ − × ÷⟩ [ Num 2 ] = ?` — slot-machine roll. Num 1 locks almost instantly;
   Num 2 decelerates slowly, giving a head start to recall before the timer starts.
3. Bottom: N multiple-choice buttons (admin-configured 3–6) in randomized positions:
   1 correct + N−1 plausible distractors (±small offsets).
4. Immediate feedback: green flash on correct; red flash + the correct answer highlighted
   on a miss/timeout. **Magic Rules** hint bubble pops when the rolled factor has one
   (e.g. ×10 → "Just add a 0 at the end!").
5. Session control: **"Stop / Finish"** between questions → session summary.

### E. Session summary
- Questions answered, accuracy %, seconds added to the time bank.

### F. Admin panel (role `admin`)
1. Dashboard & leaderboard (7-day earned time + accuracy ranking).
2. User management: create/edit users, set PINs, assign games.
3. User statistics & reset: daily logs per user + **"Reset Progress / Heatmap"**.
4. Game configuration studio: factor A/B ranges, exact-combination filter matrix,
   variant count N, reward/penalty/cap economics, "Magic Rules" hint editor.

## Domain rules (normative summaries — details in docs/API.md / docs/DATA_MODEL.md)
- **Time bank:** integer seconds per user; each answer `+base_time_reward` or `−time_penalty`
  (clock must be answered; `chosen = null` = timeout → wrong); bank clamped to
  [0, game's `max_daily_time`] (default cap 3600 s). No daily lockout — playing above the cap
  keeps logging stats but does not grow the bank.
- **Rolling heatmap:** performance per (a, b) cell over the last 7 days only — recent mastery
  replaces historical errors.
- **Targeted practice:** admins restrict ranges (e.g. 2–4 × 5–8) and/or pin an exact
  combination list per game, and pick the operations each game mixes (`+ − × ÷`).
- **SEED:** the first admin (username `admin`) is created by the seed script; also seeds one
  demo child + five demo games ("Easy Twos" and "Mixed Table" for ×, "Plus Ones" for +,
  "Take Away" for −, "Sharing" for ÷).

## Auth
- Usernames unique; 4-digit PIN (bcrypt-hashed). Role per user: `admin` | `user`.
- JWT access token (15 min, in memory) + refresh token (30 d, `HttpOnly`, `Secure`,
  `SameSite=Strict` cookie, rotated on every refresh, sha256 hash in DB).

## Non-functional
- Total RAM target: **< 150 MB** containers (api 128m, web 32m); steady api RSS ≈ 60–75 MB.
  No db server ever. Cold start < 5 s; UI load < 1 s on LAN.
- No external cloud services; all state local SQLite.
- All source TypeScript, strict mode; no CI/CD — images are built locally (arm64 for the NAS).

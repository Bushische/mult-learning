# API

**NORMATIVE REST contract. Agents must follow this verbatim; changes belong to the task that owns them.**

## Conventions

- Base URL: `/api`. JSON everywhere. Node.js 20 + Fastify; validation via zod schemas from `packages/shared` (input + output).
- Errors (centralized handler, fixed shape):
  ```json
  { "error": { "code": "<CODE>", "message": "<human readable>" } }
  ```
  Codes (text `code` mirrors HTTP status): `VALIDATION_ERROR` 400, `UNAUTHORIZED` 401,
  `FORBIDDEN` 403, `NOT_FOUND` 404, `CONFLICT` 409.
- Time values are integer seconds. Dates on the wire are ISO 8601 (timestamps as unix epoch integers where noted in DATA_MODEL).
- **Public endpoints** (no token): `GET /health`, `GET /users`, `POST /auth/login`, `POST /auth/refresh`, `POST /auth/logout`. Everything else requires auth; `/admin/*` additionally requires `role = admin`.

## Auth

- Login = `username` + 4-digit **PIN** (bcrypt-hashed in DB).
- Success issues: JWT access token (15 min, `Authorization: Bearer <token>`, kept in memory) +
  rotating refresh token (30 d) set as `HttpOnly`, `Secure`, `SameSite=Strict` cookie, `Path=/api/auth`;
  only a sha256 hash is stored in DB. `/auth/refresh` rotates the cookie.
- JWT carries `{ sub, role }`; `requireAdmin` additionally re-reads the users row so role changes
  apply without waiting for access token expiry.

## Health

- **GET /health** → `{"status":"ok"}`

## Profile switcher & sessions

| Method + Path | Perms | In | Out |
|---|---|---|---|
| GET /users | public | — | `[{ "id": "<cuid>", "username": string }]` (id + username ONLY, for the login grid) |
| POST /auth/login | public | `{ "username", "pin" }` | `{ "accessToken", "user": { "id", "username", "role" } }` + Set-Cookie refresh. 401 UNAUTHORIZED on wrong username/PIN |
| POST /auth/refresh | public | cookie | fresh `{ "accessToken", "user" }`, rotated cookie. 401 on invalid/expired |
| POST /auth/logout | public | cookie | `{"ok": true}` + cookie cleared |
| GET /me | user | — | `{ "id", "username", "role", "timeBankSeconds" }` (bank of the current day — expires at midnight UTC) |

## Games (read)

- **GET /games** (auth) → `Game[]`. A `'user'` gets ONLY games assigned to them; an `admin` gets all.
  ```json
  {
    "id": "<cuid>", "name": "Easy Twos",
    "operations": ["mul"],                          // subset of add|sub|mul|div, min 1 (default ["mul"])
    "rangeA": { "min": 2, "max": 4 }, "rangeB": { "min": 5, "max": 8 },
    "allowedCombinations": [[2,5],[2,6]] | null,   // null = every combination in the ranges
    "variantCount": 3,                              // 3..6 answer buttons
    "baseTimeReward": 10,                           // s, correct answer (before time decay)
    "timePenalty": 5,                               // s, wrong answer or timeout
    "maxDailyTime": 3600,                           // s, time bank cap (default 3600)
    "questionSeconds": 15,                          // s per question, 5..60 (default 15)
    "hints": [ { "factor": 10, "text": "Just add a 0 at the end!" } ]   // optional "operation": "add|sub|mul|div" scopes a hint to one operation
  }
  ```

## Answers (the core loop write path)

- **POST /answers** (auth) — body `{ "gameId": "<cuid>", "operation": "add|sub|mul|div" (default `"mul"`), "factorA": int, "factorB": int, "chosen": int | null, "elapsedMs": int }`
  (`null` = timeout). `elapsedMs` (required, ≥ 0) is the milliseconds from the countdown
  start to the tap, clamped server-side to `[0, questionSeconds·1000]`. Server-side only:
  1. Game must exist and be assigned to the caller (403 FORBIDDEN otherwise, 404 if no such game).
  2. `correct = chosen !== null && chosen === applyOp(factorA, factorB, operation)`.
  3. `timeDelta = correct ? +computeRewardSeconds(baseTimeReward, questionSeconds, elapsedMs, timePenalty)
     : -timePenalty` — full reward inside the 3 s grace period, then a linear shrink down to a
     floor of `min(timePenalty, baseTimeReward)`: a correct answer always pays at least what a
     mistake would cost;
     the bank is **per day**: on the first answer of a new UTC day it restarts at 0
     (`users.bank_date`), then `timeBank = clamp(startOfDay + timeDelta, 0, maxDailyTime)`
     — never negative, never above that day's cap
     (surplus answers above the cap only count for stats, not for the bank).
  4. Write one `matrix_stats` row; upsert `daily_stats` (total_tries +1; correct_tries +1 when correct;
     time_earned_seconds + timeDelta when positive only; time_lost_seconds − timeDelta when negative, i.e. only
     what was actually taken from the bank) and the matching `game_daily_stats`
     row (same counters scoped to the answered game).
  - Response `{ "correct": boolean, "rightAnswer": number, "timeBankSeconds": number, "timeDelta": number }`

## Stats (read)

- **GET /stats/heatmap** (auth, own stats) → rolling last-7-day window (`matrix_stats.timestamp ≥ now - 7d`):
  ```json
  { "cells": [ { "op": "mul", "a": 2, "b": 5, "tries": 6, "correct": 5, "accuracy": 0.83, "color": "mixed" } ] }
  ```
  one cell per (operation, combination); `accuracy` = correct / tries (`null` when tries = 0). `color` buckets: `green` accuracy ≥ 0.8,
  `red` accuracy < 0.5, `mixed` in between, `none` when tries = 0. Cells cover the game's A×B range
  (`allowedCombinations` when set).
- **GET /stats/daily** (auth) → `{ "date":"YYYY-MM-DD", "totalTries": n, "correctTries": n, "timeEarnedSeconds": n, "timeLostSeconds": n, "timeBankSeconds": n }`
- **GET /stats/per-game?days=7** (auth, 1..14, default 7) → same day×game matrix shape as
  the admin per-game endpoint, scoped to the signed-in user (oldest day first, today last).

## Admin (`requireAdmin`)

| Method + Path | In | Out / Errors |
|---|---|---|
| GET /admin/users | — | `[{ "id", "username", "role", "timeBankSeconds", "games": [gameId], "createdAt" }]` |
| POST /admin/users | `{ "username", "pin": 4 digits, "role?": "admin"\|"user" }` | 201 user; 409 CONFLICT duplicate username |
| PATCH /admin/users/:id | `{ "username?", "pin?", "role?" }` | updated user; 404 unknown id; 409 duplicate username |
| DELETE /admin/users/:id | — | 204; cascades assignments + stats; admin cannot delete the last admin |
| PUT /admin/users/:id/games | `{ "gameIds": [id] }` | 200 current assignment list |
| POST /admin/users/:id/reset | — | 204; wipes `matrix_stats` + `daily_stats` for the user, zeroes time bank |
| GET /admin/leaderboard | — | `{ "today": LeaderboardRow[], "last7Days": LeaderboardRow[] }` (each row unchanged: `userId, username, timeEarnedSeconds, accuracy`, ranked by earned desc per window). `today` = `daily_stats` rows with `date` = today (UTC); `last7Days` = rolling 7-day window |
| GET /admin/users/:id/stats | — | `{ "user": { "id", "username", "timeBankSeconds" }, "heatmap": [HeatmapCell], "last7Days": { "attempts", "correct", "incorrect", "earnedSeconds" } }` (heatmap = rolling 7-day window over the child's assigned ranges; totals = `daily_stats` sums in the window); 404 unknown id |
| GET /admin/users/:id/per-game?days=7 (1..14, default 7) | — | `{ "user": { "id", "username", "timeBankSeconds" }, "days": [{ "date": "YYYY-MM-DD", "totals": { "totalTries", "correctTries", "timeEarnedSeconds", "timeLostSeconds" }, "games": [{ "gameId", "totalTries", "correctTries", "timeEarnedSeconds", "timeLostSeconds" }] }] }` (oldest day first, today last; `totals` come from `daily_stats` so pre-T28 days still show; only games with answers that day appear); 404 unknown id |
| GET /admin/stats/daily?date=YYYY-MM-DD (default today) | — | `[{ "userId", "username", "totalTries", "correctTries", "timeEarnedSeconds", "timeLostSeconds", "timeBankSeconds" }]` |
| GET /admin/games | — | `Game[]` (all) |
| POST /admin/games | `GameConfig` (see GET /games shape) | 201 game; 400 VALIDATION_ERROR on bad ranges (min ≤ max, factors 1..20, variantCount 3..6) |
| PATCH /admin/games/:id | partial `GameConfig` | updated game; 404 unknown id |
| DELETE /admin/games/:id | — | 204; cascades its user assignments |

Note: the game CRUD/assignment endpoints are wrapped by `/admin`; the user-visible side (`GET /games`, `POST /answers`, `GET /stats/*`) uses plain paths because children only ever have their own data.

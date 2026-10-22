# Mult Learning — What It Can Do

## Learn & earn screen time
- Tap your name, enter your PIN, start playing.
- A slot-machine roll picks `Num1 × Num2`; you answer from multiple-choice buttons
  **before the countdown** runs out.
- Correct answers **add seconds** to your time bank (`+10s` per game config); wrong answers
  or timers out **take seconds** (`-5s`).
- Your bank shows live (`45:00 available`); it never grows past the game's cap (default 1 h)
  and never goes below zero. Stopping or continuing is always your choice — no lockouts.

## Pedagogy built in
- **7-day rolling heatmap:** the multiplication grid over your practice ranges, colored
  green (mastered) / mixed / red (frequent errors) based on the **last 7 days only** —
  old errors age out as soon as you re-master a cell.
- **Magic Rules:** passing hints teach shortcuts natively (×10 → "Just add a 0 at the end!").
- **Two-stage roll:** the second number decelerates slowly so you can start calculating
  before the countdown even begins.
- **Targeted practice:** parents can restrict games to exact ranges (e.g. 2–4 × 5–8)
  or precise combinations.

## Admin control center
- Manage children (names, PINs, roles) and assign each one a different game.
- Game studio: factor ranges, exact-combination filter, 3–6 answer variants,
  reward/penalty seconds, daily cap, custom magic-rule hints.
- Leaderboard (7-day earned time + accuracy), daily statistics per child,
  and a full **"Reset Progress / Heatmap"** button.

## Running it
- Dev: Docker Compose (`docker compose up`) — `web` proxies `/api` to `api`.
- Prod: arm64 images built on the laptop; SQLite inside the container volume on the NAS.
- **Backups:** daily consistent SQLite `.backup` snapshots; tested restore drill — see `docs/DEPLOYMENT.md`.

## On the roadmap (specced, pending)
- PWA install + offline shell polish beyond the app skeleton (T15).
- Deployment runbook + Synology Container Manager smoke tests (T16).

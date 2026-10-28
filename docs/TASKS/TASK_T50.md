# T50 — Seed demo games for the new operations and close out docs

- **Goal:** a fresh install demonstrates every operation on day one.
- **Inputs:** T42–T49, seed script (Easy Twos / Mixed Table today), docs (DATA_MODEL, API.md, studio copy).
- **Outputs:** seed adds demo games covering the new operations (e.g. "Plus Ones" 1–10 + 1–10, "Take Away" subtraction 5–15 − 1–9, "Sharing" exact divisions) assigned to the demo child; docs updated where screenshots/copy still say `×`-only.
- **Test cases:**
  1. Setup: empty DB. Action: run seed twice. Expected: new games exist once each (idempotent, matched by name), assigned to `child1`.
  2. Setup: seeded DB. Action: log in as `child1`, open the dashboard. Expected: the new games list with correct per-game operations.
  3. Setup: seeded DB. Action: play one `÷` question in the demo game. Expected: exact-division question, correct answer credited.
- **Definition of Done:** cases 1–3 pinned by seed/API tests; full gate `pnpm test && pnpm lint`.
- **Dependencies:** T49

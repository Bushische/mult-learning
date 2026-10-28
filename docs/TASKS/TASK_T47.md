# T47 — Game studio: operation picker

- **Goal:** admins compose games like "× and ÷" or "+ only" without touching internals.
- **Inputs:** T42 contracts, `features/admin/games/` studio form + validation.
- **Outputs:** an operation multi-select (checkboxes `+ − × ÷`, at least one required, inline error otherwise); saved through the shared schema; game list shows the operations per game.
- **Test cases:**
  1. Setup: admin creates "Plus and Minus" with operations `[add, sub]`. Action: save, assign to a child. Expected: the child plays mixed `+`/`−` questions only.
  2. Setup: studio form. Action: uncheck every operation, try to save. Expected: inline error, nothing submitted.
  3. Setup: existing `×`-only game. Action: open in studio. Expected: only `×` checked (migration default), saving unchanged keeps it `×`-only.
- **Definition of Done:** cases 1–3 pinned by admin games tests; full gate `pnpm test && pnpm lint`.
- **Dependencies:** T46

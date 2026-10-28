# T42 — Shared operation contract and storage

- **Goal:** `+ − × ÷` become first-class citizens: every app speaks the same operation language and games store their operation list.
- **Inputs:** `packages/shared` game schemas, `docs/DATA_MODEL.md` (games), `docs/API.md` (Games shape), Drizzle migration flow.
- **Outputs:** shared `operationSchema` (`add|sub|mul|div`) + symbols; `Game`/`GameConfig` gain `operations: Operation[]` (min 1, default `["mul"]` so old games keep working); `games.operations_json` column + migration; API contract updated.
- **Test cases:**
  1. Setup: none. Action: parse a game with `operations: ["add", "mul"]`. Expected: parses; `[]` and unknown ops are rejected.
  2. Setup: old DB row without the column. Action: run migrations. Expected: the column appears defaulting to `["mul"]`, old games load unchanged.
  3. Setup: `GET /games`, `GET /admin/games`. Action: fetch. Expected: every game serializes its `operations` list.
- **Definition of Done:** cases 1–3 pinned by shared/API tests; full gate `pnpm test && pnpm lint`.
- **Dependencies:** T41

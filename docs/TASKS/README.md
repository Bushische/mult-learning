# Tasks — per-task files

All work uses one small file per task here (`docs/TASKS/`), so an agent session
reads ~2 KB instead of one giant spec/log. An agent session reads only its own
task file plus the digest — never the whole directory.

## Naming

- Spec: `docs/TASKS/TASK_<ID>.md` — e.g. `TASK_T1.md`. `<ID>` is the task id verbatim
  (`T1`, `T2`, …; integers only, no `x.y` variants).
- Log: `docs/TASKS/EXECUTION_LOG_<ID>.md` — e.g. `EXECUTION_LOG_T1.md`, created by the
  orchestrator when execution starts, never by hand for a new task.

## Lifecycle

- `PENDING` = spec file exists, no log file yet.
- `IN_PROGRESS` / `DONE` / `BLOCKED` = log file exists with a `- Status:` line.
- The orchestrator (`scripts/run-next-task.sh`) picks the first non-`DONE` task in
  version-sorted ID order, skipping `BLOCKED` (needs a human; rerun explicitly).
- The agent updates ONLY its own `EXECUTION_LOG_<ID>.md`.

## Log file (exactly this shape)

```markdown
# Execution Log — T5 — <same title as the spec>

- Task: T5
- Status: DONE
- Date: YYYY-MM-DD
- Commit: <short sha — filled by the orchestrator after its one commit>
- Model: <model id>

## Notes
<one-line reason when BLOCKED>

## Session notes
- YYYY-MM-DD | T5 | <model id> | <summary of changes: files, endpoints, decisions, issues> (≤200 chars)
```

## Adding a new task

1. Next ID = max existing + 1 (`ls docs/TASKS/TASK_*.md`).
2. Copy this format (concise but implementable — Goal, Inputs, Outputs, Definition of
   Done, Dependencies; 15–40 lines):
   ```markdown
   # T1 — Short title
   - **Goal:** one sentence: what changes for the user.
   - **Inputs:** files/specs/contracts the task builds on.
   - **Outputs:** files/endpoints/schemas the task creates.
   - **Definition of Done:** observable checks + tests that pin them.
   - **Dependencies:** task IDs that must be DONE first.
   ```
3. No log file — its absence IS the `PENDING` state.
4. Run `node scripts/check-log-integrity.mjs` to validate.

## Agent read rules (context budget)

- Always: `docs/CONTEXT.md` + your own `docs/TASKS/TASK_<ID>.md`.
- `docs/DATA_MODEL.md` / `docs/API.md` ONLY if the task touches API shapes, DB schema,
  or endpoint behavior.
- Another task's `EXECUTION_LOG_<ID>.md` ONLY to check a dependency's execution result
  (did it land? what files? what gotchas?) — never the whole directory.
- NEVER read other tasks' specs.

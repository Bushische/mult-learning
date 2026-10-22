# Single-Session Execution — run the whole task queue in ONE agent session

## When to use

- **Use** when you want the whole backlog implemented in one pass without re-reading the
  digest/contracts per task (fastest, cheapest in context re-reads).
- **Don't use** when you want per-task independent review: the standard mode
  (`scripts/run-next-task.sh`) spawns a **fresh** session per task, so a drifted or buggy
  task cannot leak into the next one.

Tradeoffs of one session: context grows (drift + compaction risk). Mitigations baked into the
prompt below: the gate runs after **every** task, exactly one commit per task, and a tiny
scratchpad (`local-data/session-state.md`, gitignored) survives compaction.

## Difference from the standard mode

| | standard (`run-next-task.sh`) | single-session |
|---|---|---|
| sessions | one fresh per task | one for the whole queue |
| who commits | the orchestrator, after verifying | the **agent** (per task, after its own gate) |
| context | re-read per task | read once, carried in-session |

In single-session mode the orchestrator only runs the agent, then re-verifies the final tree
and prints the log — it never commits on the agent's behalf.

## Run it

```bash
./scripts/run-next-task.sh --single-session          # whole queue, default model (MiniMax)
./scripts/run-next-task.sh --single-session --model <id>
./scripts/run-next-task.sh --single-session --list   # show the queue only (no run)
```

Manual equivalent (the script does exactly this):

```bash
opencode run --auto -m opencode/minimax-m3.1-flash-free \
  -f docs/CONTEXT.md -f docs/API.md -f docs/DATA_MODEL.md \
  -f docs/CONVENTIONS.md -f docs/PROJECT.md -f docs/TASKS/README.md \
  -f docs/TASKS/TASK_T1.md -f docs/TASKS/TASK_T2.md ... \
  --title "mult-learning single-session" "$(cat docs/SINGLE_SESSION_PROMPT.md)"
```

The `-f` attachments are what makes "no re-reading" real: the digest, the contracts and every
task spec enter the context up front.

## The prompt
<!-- PROMPT-START -->
You are the implementation agent for the mult-learning project. Work in the repository root.
Execute ALL pending tasks in dependency order, in THIS ONE session. Never stop after one task.

CONTEXT — read ONCE, now (do not re-read later):
  docs/CONTEXT.md, docs/API.md, docs/DATA_MODEL.md, docs/CONVENTIONS.md, docs/PROJECT.md
  and every spec docs/TASKS/TASK_T*.md (sorted by numeric ID).
  These stay in your context for the whole run — never re-read them.
  Also read docs/TASKS/README.md (workflow rules) once.

QUEUE: all specs in docs/TASKS/, numeric ID order. A task is PENDING when
docs/TASKS/EXECUTION_LOG_<ID>.md does not exist yet; DONE/BLOCKED when it exists.

STATE NOTEBOOK (your memory across compaction): maintain the file
  local-data/session-state.md  (gitignored — create the dir if needed)
After EVERY task, rewrite it with: next task id, files created so far, key decisions
(env vars, ports, schema choices, naming), open questions, and the last green gate result.
If your context is compacted or you lose track, re-read ONLY this file and the current
task spec — never the other docs.

FOR EACH TASK, in order:
1. Pick the first task whose Dependencies are all DONE. Skip (and report) any whose
   dependency is not DONE — mark it BLOCKED with a one-line reason under `## Notes`
   and continue with the tasks that are unblocked.
2. Create docs/TASKS/EXECUTION_LOG_<ID>.md (if it does not exist) with exactly:
   # Execution Log — <ID> — <same title as the spec>
   - Task: <ID>
   - Status: IN PROGRESS
   - Date:
   - Commit:
   - Model: <your model id>
   ## Notes
   ## Session notes
   Update ONLY this task's log. Never touch another task's spec or log.
3. Implement the task up to its Definition of Done, following docs/CONVENTIONS.md:
   strict TS, zod validation at boundaries, thin routes + service layer (api),
   feature folders (web), colocated *.test.ts(x) for every DoD test case.
   Never modify docs/API.md or docs/DATA_MODEL.md unless this task owns them.
4. Verify: run ONLY the tests of the code you touched while iterating; then the FULL gate
   once per task: `pnpm lint && pnpm test && node scripts/check-log-integrity.mjs`.
   Fix failures; never lower the gate. If the gate cannot go green after 2 honest attempts,
   set `- Status: BLOCKED` with the reason and move on.
5. On green: set `- Status: DONE`, fill `- Date:` (YYYY-MM-DD), append ONE session line
   under `## Session notes`:
   - YYYY-MM-DD | <ID> | <model id> | <what changed; key files; gate green>  (<=200 chars)
6. COMMIT — you own the commit in this mode (the orchestrator is not committing for you):
   git add -A && git commit -m "feat(<ID>): <title>"
   then stamp the short sha into the log's `- Commit:` line and amend so the log ships
   with its own sha:
   SHA=$(git rev-parse --short HEAD)
   perl -pi -e "s/^- Commit:.*/- Commit: $SHA/" docs/TASKS/EXECUTION_LOG_<ID>.md
   git add -A && git commit --amend --no-edit
   EXACTLY one commit per task. Never push, never create branches, never amend a PREVIOUS
   task's commit.
7. Update local-data/session-state.md and continue with the next task.

FINAL REPORT (max 20 lines): a table of every task — ID, status, commit sha, one-line summary —
then: deviations from the specs, remaining BLOCKED tasks and why, and anything the user must do
(manual smoke tests, NAS deployment, admin seeding).
<!-- PROMPT-END -->

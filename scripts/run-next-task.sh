#!/usr/bin/env bash
# Orchestrator: spawn a fresh opencode agent per task, verify, commit.
# Model: one spec file per task (docs/TASKS/TASK_<ID>.md), one log file per executed
# task (docs/TASKS/EXECUTION_LOG_<ID>.md). PENDING = spec exists, no log file yet.
# Usage:
#   ./scripts/run-next-task.sh          # next unfinished task, one shot (default model: MiniMax M3.1 Flash Free)
#   ./scripts/run-next-task.sh T1       # (re)execute a specific task
#   ./scripts/run-next-task.sh --loop   # loop until failure or all tasks DONE
#   ./scripts/run-next-task.sh --list   # show queue with statuses, no execution
#   ./scripts/run-next-task.sh --single-session  # ONE agent session for the whole queue
#                          (the agent then commits per task itself — see docs/SINGLE_SESSION_PROMPT.md)
# Model selection (precedence: flag > $OPENCODE_MODEL > default):
#   ./scripts/run-next-task.sh --minimax            # MiniMax shortcut (the default)
#   ./scripts/run-next-task.sh --deepseek            # DeepSeek shortcut
#   ./scripts/run-next-task.sh --spark              # Muse Spark shortcut (legacy)
#   ./scripts/run-next-task.sh --model <id> --loop   # any opencode model id
#   OPENCODE_MODEL=<id> ./scripts/run-next-task.sh   # via environment
set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT="mult-learning"
TASKS_DIR="docs/TASKS"
MODEL_DEFAULT_MINIMAX="opencode/minimax-m3.1-flash-free"
MODEL_DEFAULT_SPARK="opencode/muse-spark-1.3-contributor-free"
MODEL_DEEPSEEK="openrouter/deepseek/deepseek-chat"
MODEL="${OPENCODE_MODEL:-$MODEL_DEFAULT_MINIMAX}"

log_file() { # <task-id> -> path
  echo "$TASKS_DIR/EXECUTION_LOG_$1.md"
}

spec_file() { # <task-id> -> path
  echo "$TASKS_DIR/TASK_$1.md"
}

task_ids() {
  # Version-sorted task IDs from spec filenames (TASK_<ID>.md).
  local f id
  for f in "$TASKS_DIR"/TASK_*.md; do
    [ -e "$f" ] || return 0
    id="$(basename "$f" .md)"
    id="${id#TASK_}"
    echo "$id"
  done | sort -V
}

task_status() { # <task-id> -> PENDING|IN_PROGRESS|DONE|BLOCKED|UNKNOWN
  local lf
  lf="$(log_file "$1")"
  if [ ! -f "$lf" ]; then
    echo "PENDING"
    return 0
  fi
  local st
  st="$(grep -m1 -E '^- Status:' "$lf" | awk '{print $3}' || true)"
  case "$st" in
    PENDING|IN_PROGRESS|DONE|BLOCKED) echo "$st" ;;
    *) echo "UNKNOWN" ;;
  esac
}

task_title() { # <task-id> -> title from "# <ID> — <title>" heading
  local sf line
  sf="$(spec_file "$1")"
  line="$(grep -m1 -E "^# +$1( +— +|$)" "$sf" || true)"
  line="${line#\# }"
  line="${line#$1 }"
  line="${line#— }"
  echo "$line"
}

list_queue() {
  local id st
  for id in $(task_ids); do
    st="$(task_status "$id")"
    printf '%s | %s | %s\n' "$id" "$st" "$(task_title "$id")"
  done
}

get_next_task() {
  # First non-DONE task in sorted order, skipping BLOCKED (needs a human).
  local id st
  for id in $(task_ids); do
    st="$(task_status "$id")"
    case "$st" in
      PENDING|IN_PROGRESS|UNKNOWN) echo "$id"; return 0 ;;
    esac
  done
  echo ""
}

# ensure_log <task-id> — create the per-task log with Status IN_PROGRESS (rule: log is
# created when execution starts).
ensure_log() {
  local lf title
  lf="$(log_file "$1")"
  title="$(task_title "$1")"
  if [ -f "$lf" ]; then
    set_status "$1" "IN_PROGRESS"
    return 0
  fi
  cat > "$lf" <<EOF
# Execution Log — $1 — $title

- Task: $1
- Status: IN_PROGRESS
- Date:
- Commit:
- Model: $MODEL

## Notes

## Session notes
EOF
}

# set_status <task> <status> [stamp_date]
set_status() {
  local lf="$TASKS_DIR/EXECUTION_LOG_$1.md"
  if sed --version >/dev/null 2>&1; then
    sed -i -e "s/^- Status:.*/- Status: $2/" "$lf"
  else
    sed -i '' -e "s/^- Status:.*/- Status: $2/" "$lf"
  fi
  if [ "${3:-}" = "date" ]; then
    local today d
    today="$(date +%F)"
    d="$(grep -m1 -E '^- Date:' "$lf" | sed 's/^- Date: *//' || true)"
    if [ -z "$d" ]; then
      if sed --version >/dev/null 2>&1; then
        sed -i -e "s/^- Date:.*/- Date: $today/" "$lf"
      else
        sed -i '' -e "s/^- Date:.*/- Date: $today/" "$lf"
      fi
    fi
  fi
}

append_note() { # <task> <text>
  printf -- '- %s | %s | %s | %s\n' "$(date +%F)" "$1" "$MODEL" "$2" >> "$(log_file "$1")"
}

# append_commit <task> — stamp the executing commit's short sha into the log's "- Commit:" line.
append_commit() {
  local lf sha
  lf="$(log_file "$1")"
  sha="$(git rev-parse --short HEAD)"
  if sed --version >/dev/null 2>&1; then
    sed -i -e "s/^- Commit:.*/- Commit: $sha/" "$lf"
  else
    sed -i '' -e "s/^- Commit:.*/- Commit: $sha/" "$lf"
  fi
}

verify() {
  if [ ! -f package.json ]; then
    echo "[verify] no package.json yet — skipping lint/test"
    return 0
  fi
  if ! command -v pnpm > /dev/null; then
    echo "[verify] pnpm is required once package.json exists (corepack enable)"
    return 1
  fi
  pnpm install
  pnpm run --if-present lint
  pnpm run --if-present test
  node scripts/check-log-integrity.mjs
}

run_one() { # <task>
  local task="$1" title spec own_log prompt
  if [ ! -f "$(spec_file "$task")" ]; then
    echo "[!] No spec file: $(spec_file "$task")"
    return 1
  fi
  title="$(task_title "$task")"
  echo "==> Task $task: $title"

  ensure_log "$task"
  spec="$(cat "$(spec_file "$task")")"
  own_log="$(cat "$(log_file "$task")")"
  prompt="You are the implementation agent. Complete exactly ONE task ($task), then stop. Work in the current repository root.

Context budget — read ONLY these (do NOT read other docs/TASKS/ files unless named below):
1. docs/CONTEXT.md — project digest (always read this).
2. The task spec below (your ONLY task — already inlined, do not re-read from disk):
---
$spec
---
3. Your own execution log below (already inlined, do not re-read from disk):
---
$own_log
---
4. docs/DATA_MODEL.md and docs/API.md (contracts — follow verbatim) — ONLY if the task touches API shapes, DB schema, endpoint behavior, or shared schemas.
5. Another task's docs/TASKS/EXECUTION_LOG_<ID>.md — ONLY to check a dependency's execution result named in your Dependencies (did it land? which files? any gotchas?). Never scan the whole docs/TASKS/ directory.

Scope rules:
- Implement ONLY task $task as specified, up to its Definition of Done.
- Never modify the contracts (docs/DATA_MODEL.md, docs/API.md) or other tasks' outputs. Shared types/schemas go into packages/shared.
- Do NOT run git commit, do NOT create branches — the orchestrator commits after verification.
- Update ONLY docs/TASKS/EXECUTION_LOG_$task.md: keep '- Status:' accurate (IN_PROGRESS while working; DONE or BLOCKED when stopping with Date filled on DONE) and append ONE session line under '## Session notes': '- YYYY-MM-DD | $task | <model> | <what was built: files, endpoints, decisions, issues>' (max ~200 chars).
- If the task is ambiguous or cannot reach its Definition of Done, set '- Status: BLOCKED' with a one-line reason under '## Notes', and stop.

Implement following docs/CONVENTIONS.md:
- Strict TypeScript, zod validation at boundaries, routes thin + service layer (api), feature folders (web).
- Write the tests the task's Definition of Done requires.
- Keep existing tests green; fix the code, not the test expectations, unless the task says otherwise.

Verify before stopping:
- pnpm install (first run only).
- During the edit loop, run ONLY the tests for the code you touched plus 'pnpm lint' on edited files. Iterate cheaply; do not re-run the full suite after every edit.
- Before finishing, run the full gate ONCE: 'pnpm lint && pnpm test'. Everything must pass.

Finish with a short report (max 5 bullets): what was built, test results, anything the next task should know."

  if ! opencode run --auto -m "$MODEL" --title "$PROJECT $task" "$prompt"; then
    append_note "$task" "agent session exited with an error — task left IN_PROGRESS"
    echo "[!] Agent failed for $task — inspect and rerun: ./scripts/run-next-task.sh $task"
    return 1
  fi

  echo "==> Verifying $task"
  if ! verify; then
    append_note "$task" "verification failed (lint/test) — changes left uncommitted for inspection"
    echo "[!] Verification FAILED for $task — changes left uncommitted for inspection."
    echo "    Fix and rerun:  ./scripts/run-next-task.sh $task"
    return 1
  fi

  set_status "$task" "DONE" "date"
  git add -A
  if git diff --cached --quiet; then
    append_note "$task" "agent produced no changes"
    echo "[!] Nothing to commit for $task."
  else
    git commit -m "feat($task): $title"
    append_commit "$task"
    append_note "$task" "completed and committed ($(git rev-parse --short HEAD))"
  fi
  echo "==> $task DONE"
}

# extract_prompt <file> — the text between <!-- PROMPT-START --> and <!-- PROMPT-END -->.
extract_prompt() {
  sed -n '/<!-- PROMPT-START -->/,/<!-- PROMPT-END -->/p' "$1" | sed -e '1d' -e '$d'
}

# run_single_session — one agent session for the WHOLE queue (docs/SINGLE_SESSION_PROMPT.md).
# The agent owns the per-task commits here; the orchestrator only runs it and re-verifies.
run_single_session() {
  local prompt_file="docs/SINGLE_SESSION_PROMPT.md"
  if [ ! -f "$prompt_file" ]; then
    echo "[!] Missing $prompt_file"
    return 1
  fi
  local prompt
  prompt="$(extract_prompt "$prompt_file")"
  if [ -z "$prompt" ]; then
    echo "[!] No prompt found between the PROMPT-START/PROMPT-END markers in $prompt_file"
    return 1
  fi

  local -a attach=()
  local f
  for f in docs/CONTEXT.md docs/API.md docs/DATA_MODEL.md docs/CONVENTIONS.md docs/PROJECT.md \
    docs/TASKS/README.md; do
    [ -f "$f" ] && attach+=(-f "$f")
  done
  for f in "$TASKS_DIR"/TASK_*.md; do
    [ -e "$f" ] || continue
    attach+=(-f "$f")
  done

  echo "==> Single-session run: model $MODEL ($((${#attach[@]} / 2)) docs attached)"
  if ! opencode run --auto -m "$MODEL" --title "$PROJECT single-session" "${attach[@]}" "$prompt"; then
    echo "[!] Single-session agent exited with an error."
    return 1
  fi

  echo "==> Verifying final tree"
  if ! verify; then
    echo "[!] Verification FAILED — inspect the tree; nothing was committed by the orchestrator."
    return 1
  fi
  echo "==> Recent commits:"
  git log --oneline -20
}

main() {
  # Leading model flags (flag > $OPENCODE_MODEL > default).
  while [ $# -gt 0 ]; do
    case "$1" in
      --model)
        [ $# -ge 2 ] || { echo "[!] --model needs a model id"; exit 1; }
        MODEL="$2"; shift 2
        ;;
      --deepseek)
        MODEL="$MODEL_DEEPSEEK"; shift
        ;;
      --minimax)
        MODEL="$MODEL_DEFAULT_MINIMAX"; shift
        ;;
      --spark)
        MODEL="$MODEL_DEFAULT_SPARK"; shift
        ;;
      --) shift; break ;;
      *) break ;;
    esac
  done
  local arg="${1:-}"
  echo "==> Model: $MODEL"
  case "$arg" in
    --loop)
      while :; do
        local task
        task="$(get_next_task)"
        [ -z "$task" ] && { echo "All tasks DONE."; exit 0; }
        run_one "$task" || exit $?
      done
      ;;
    --single-session)
      run_single_session
      ;;
    --list)
      list_queue
      ;;
    "")
      local task
      task="$(get_next_task)"
      if [ -z "$task" ]; then echo "All tasks DONE."; exit 0; fi
      run_one "$task"
      ;;
    T*)
      run_one "$arg"
      ;;
    *)
      echo "Usage: $0 [--model <id> | --minimax | --deepseek | --spark] [--loop | --single-session | --list | Tn]"
      echo "       (e.g. $0 --deepseek T1, $0 --loop, $0 --single-session)"
      exit 1
      ;;
  esac
}

if [[ "${BASH_SOURCE[0]:-$0}" == "$0" ]]; then
  main "$@"
fi

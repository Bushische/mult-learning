#!/usr/bin/env bash
# Deterministic verification gate (run by the orchestrator instead of trusting agent-run checks).
# Usage: ./scripts/verify.sh          # install + lint + test + Tasks log integrity
# Exit 0 = green. Non-zero = broken; orchestrator must not commit.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> [1/4] pnpm install"
pnpm install

echo "==> [2/4] pnpm lint"
pnpm run --if-present lint

echo "==> [3/4] pnpm test"
pnpm run --if-present test

echo "==> [4/4] Tasks integrity (TASK_<ID>.md <-> EXECUTION_LOG_<ID>.md)"
node scripts/check-log-integrity.mjs

echo "==> verify: ALL GREEN"

#!/usr/bin/env node
// Log integrity gate: docs/TASKS/TASK_<ID>.md <-> docs/TASKS/EXECUTION_LOG_<ID>.md must agree.
// Catches drift between specs and per-task logs (missing/rereferenced files,
// unknown statuses, multiple IN_PROGRESS tasks).
// Exit 0 = consistent, exit 1 = problems (printed).
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const VALID_STATUSES = new Set(["PENDING", "IN_PROGRESS", "DONE", "BLOCKED"]);

const read = (p) => readFileSync(join(root, p), "utf8");
const fail = (problems) => {
  for (const p of problems) console.error(`INTEGRITY: ${p}`);
  console.error(`INTEGRITY: ${problems.length} problem(s) found`);
  process.exit(1);
};

const problems = [];
const newIds = new Set();
if (existsSync(join(root, "docs", "TASKS"))) {
  const files = readdirSync(join(root, "docs", "TASKS"));
  for (const f of files) {
    const m = f.match(/^TASK_(T\d+)\.md$/);
    if (!m) continue;
    const id = m[1];
    if (newIds.has(id)) problems.push(`docs/TASKS: duplicate spec for ${id}`);
    newIds.add(id);
    const body = read(`docs/TASKS/${f}`);
    if (!new RegExp(`^#\\s+${id}\\b`, "m").test(body)) {
      problems.push(`docs/TASKS/${f}: first heading must be "# ${id} — <title>"`);
    }
    if (!/Definition of Done/.test(body)) {
      problems.push(`docs/TASKS/${f}: missing Definition of Done`);
    }
  }
  let inProgress = 0;
  for (const f of files) {
    const m = f.match(/^EXECUTION_LOG_(T\d+)\.md$/);
    if (!m) continue;
    const id = m[1];
    if (!newIds.has(id)) {
      problems.push(`docs/TASKS/${f}: no matching TASK_${id}.md`);
      continue;
    }
    const body = read(`docs/TASKS/${f}`);
    const st = (body.match(/^-\s*Status:\s*(\S+)/m) || [])[1] ?? "";
    if (!VALID_STATUSES.has(st)) {
      problems.push(`docs/TASKS/${f}: unknown Status "${st}"`);
    }
    if (body.match(/^-\s*Task:\s*(\S+)/m)?.[1] !== id) {
      problems.push(`docs/TASKS/${f}: "- Task:" must be "${id}"`);
    }
    if (
      st === "DONE" &&
      !(body.match(/^-\s*Date:\s*(\S+)/m) || [])[1]?.match(/^\d{4}-\d{2}-\d{2}$/)
    ) {
      problems.push(`docs/TASKS/${f}: DONE without a YYYY-MM-DD Date`);
    }
    if (st === "IN_PROGRESS") inProgress++;
  }
  if (inProgress > 1) {
    problems.push(`docs/TASKS: multiple IN_PROGRESS logs (${inProgress})`);
  }
}

if (problems.length) fail(problems);
console.log(`INTEGRITY: ok — ${newIds.size} per-task spec(s) in docs/TASKS/, all consistent`);

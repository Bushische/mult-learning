#!/usr/bin/env node
/**
 * Dev entrypoint (used by docker-compose: `node src/dev-server.mjs`).
 *
 * The api sources are TypeScript, so this thin launcher runs them through
 * `tsx watch`, which reloads the process whenever a source file changes.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function resolveTsxCli() {
  try {
    return require.resolve("tsx/cli");
  } catch {
    return null;
  }
}

const tsxCli = resolveTsxCli();
const args = tsxCli ? [tsxCli, "watch", "src/index.ts"] : ["--import", "tsx", "src/index.ts"];
const child = spawn(process.execPath, args, { stdio: "inherit", env: process.env });

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

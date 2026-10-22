#!/usr/bin/env node
/**
 * Dev entrypoint for the web app (used by docker-compose: `node src/dev-server.mjs`).
 *
 * Starts the Vite dev server; `/api` is proxied to the api container
 * (see vite.config.ts — API_HOST / API_PORT / WEB_PORT).
 */
import { createServer } from "vite";

const port = Number(process.env.WEB_PORT ?? 5173);
const host = process.env.WEB_HOST ?? "0.0.0.0";

const server = await createServer({
  configFile: new URL("../vite.config.ts", import.meta.url).pathname,
  server: { port, host, strictPort: false },
});

await server.listen();
server.printUrls();

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    void server.close().then(() => process.exit(0));
  });
}

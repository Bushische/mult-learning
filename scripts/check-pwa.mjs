#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync } from "node:fs";
/**
 * PWA check (T15): builds nothing — it serves the existing production bundle
 * (apps/web/dist) and verifies the manifest, the icons and the service worker.
 *
 * Usage: node scripts/check-pwa.mjs
 * Exit 0 = green.
 */
import { createServer } from "node:http";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "apps/web/dist");

if (!existsSync(dist)) {
  console.error("apps/web/dist is missing — run `pnpm --filter web build` first.");
  process.exit(1);
}

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", "http://localhost");
  let file = join(dist, decodeURIComponent(url.pathname));
  if (url.pathname === "/" || !existsSync(file)) file = join(dist, "index.html");
  if (!existsSync(file)) {
    response.writeHead(404).end("not found");
    return;
  }
  response.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
  response.end(readFileSync(file));
});

const port = 4321;
await new Promise((resolve) => server.listen(port, resolve));

const problems = [];
const base = `http://127.0.0.1:${port}`;

const manifestResponse = await fetch(`${base}/manifest.webmanifest`);
if (!manifestResponse.ok) {
  problems.push(`manifest.webmanifest missing (${manifestResponse.status})`);
} else {
  const manifest = await manifestResponse.json();
  for (const field of ["name", "short_name", "start_url", "display", "icons"]) {
    if (!manifest[field]) problems.push(`manifest is missing "${field}"`);
  }
  if (manifest.display !== "standalone") problems.push("display must be standalone");
  if (!manifest.orientation) problems.push("manifest is missing an orientation");
  const sizes = (manifest.icons ?? []).map((icon) => icon.sizes);
  if (!sizes.includes("192x192")) problems.push("no 192x192 icon");
  if (!sizes.includes("512x512")) problems.push("no 512x512 icon");
  for (const icon of manifest.icons ?? []) {
    const iconResponse = await fetch(`${base}/${icon.src.replace(/^\//, "")}`);
    if (!iconResponse.ok) problems.push(`icon ${icon.src} is missing`);
  }
  console.log("manifest:", JSON.stringify(manifest, null, 2));
}

const swResponse = await fetch(`${base}/sw.js`);
if (!swResponse.ok) {
  problems.push(`sw.js missing (${swResponse.status})`);
} else {
  const sw = await swResponse.text();
  if (!sw.includes("NetworkOnly"))
    problems.push("the service worker does not use NetworkOnly for /api");
  if (!sw.includes("precacheAndRoute"))
    problems.push("the service worker does not precache the shell");
  console.log(`sw.js: ${sw.length} bytes, NetworkOnly=${sw.includes("NetworkOnly")}`);
}

const index = await (await fetch(`${base}/`)).text();
if (!index.includes("manifest.webmanifest")) problems.push("index.html does not link the manifest");

// the bundle must register the service worker
const assetsDir = join(dist, "assets");
const bundles = existsSync(assetsDir)
  ? readdirSync(assetsDir).filter((file) => file.endsWith(".js"))
  : [];
let registers = false;
for (const file of bundles) {
  const content = readFileSync(join(assetsDir, file), "utf8");
  if (content.includes("registerSW") || content.includes("serviceWorker")) registers = true;
}
if (!registers) problems.push("the bundle does not register the service worker");

server.close();

if (problems.length > 0) {
  for (const problem of problems) console.error(`PWA CHECK: ${problem}`);
  process.exit(1);
}
console.log("PWA CHECK: ok — manifest, icons and service worker are in place");

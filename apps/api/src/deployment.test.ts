import { constants, accessSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relative: string): string {
  return readFileSync(join(root, relative), "utf8");
}

describe("T16 — deployment assets", () => {
  it("case 1: the api image is a multi-stage build that migrates at boot", () => {
    const dockerfile = read("apps/api/Dockerfile");
    expect(dockerfile).toContain("FROM node:22-alpine AS base");
    expect(dockerfile).toContain("AS deps");
    expect(dockerfile).toContain("AS build");
    expect(dockerfile).toContain("AS release");
    expect(dockerfile).toContain("pnpm --filter api build");
    expect(dockerfile).toContain('CMD ["node", "dist/src/index.js"]');
    expect(dockerfile).toContain("DATABASE_PATH=/data/app.db");
    // the migrations live next to the build output (needed at boot)
    expect(dockerfile).toContain("COPY --from=build /app/apps/api/drizzle");
  });

  it("case 1: the web image serves the static PWA and proxies /api", () => {
    const dockerfile = read("apps/web/Dockerfile");
    expect(dockerfile).toContain("FROM nginx:alpine AS release");
    expect(dockerfile).toContain("COPY --from=build /app/apps/web/dist /usr/share/nginx/html");

    const nginx = read("apps/web/nginx.conf");
    expect(nginx).toContain("location /api/");
    expect(nginx).toContain("proxy_pass http://api:3000;");
    expect(nginx).toContain("try_files $uri $uri/ /index.html;");
  });

  it("case 2: the production compose file respects the RAM budget", () => {
    const compose = read("docker-compose.prod.yml");
    expect(compose).toContain("mem_limit: 128m");
    expect(compose).toContain("mem_limit: 32m");
    expect(compose).toContain("'${WEB_PORT:-8080}:80'");
    expect(compose).toContain("- data:/data");
    expect(compose).toContain("JWT_SECRET:");
  });

  it("case 2: the deploy + smoke + backup scripts exist and are executable", () => {
    for (const script of ["build-images.sh", "deploy.sh", "smoke.sh", "backup.sh"]) {
      const path = join(root, "scripts", script);
      expect(() => accessSync(path, constants.X_OK)).not.toThrow();
    }
    expect(read("scripts/build-images.sh")).toContain("--platform");
    expect(read("scripts/deploy.sh")).toContain("docker compose");
    expect(read("scripts/smoke.sh")).toContain("/answers");
    expect(read("scripts/backup.sh")).toContain(".backup");
  });

  it("case 3: the runbook documents the seed, the backups and the restore drill", () => {
    const runbook = read("docs/DEPLOYMENT.md");
    expect(runbook).toContain("Container Manager");
    expect(runbook).toContain("dist/scripts/seed.js");
    expect(runbook).toContain(".backup");
    expect(runbook).toContain("app.db-wal");
    expect(runbook).toContain("Restore drill");
    expect(runbook).toContain("JWT_SECRET");
  });
});

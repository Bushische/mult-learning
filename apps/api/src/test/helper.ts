import { buildApp } from "../app.js";
import type { AppConfig } from "../config.js";
import { type Db, createDb } from "../db/client.js";
import { runMigrations } from "../db/migrate.js";
import { seedDatabase } from "../db/seed.js";

export const testConfig: AppConfig = {
  nodeEnv: "test",
  host: "127.0.0.1",
  port: 0,
  logLevel: "silent",
  jwtSecret: "test-secret-value",
  databasePath: ":memory:",
  corsOrigins: null,
};

export interface TestApp {
  app: Awaited<ReturnType<typeof buildApp>>;
  db: Db;
  close: () => Promise<void>;
}

/** Build an app backed by a migrated + seeded in-memory database. */
export async function createTestApp(): Promise<TestApp> {
  const { db, sqlite } = createDb(":memory:");
  runMigrations(db);
  seedDatabase(db);
  const app = await buildApp({ config: testConfig, logger: false, db });
  return {
    app,
    db,
    close: async () => {
      await app.close();
      sqlite.close();
    },
  };
}

/** Extract the refresh cookie value from a response's `set-cookie` header. */
export function readRefreshCookie(headers: Record<string, unknown>): string | null {
  const raw = headers["set-cookie"];
  const first = Array.isArray(raw) ? raw[0] : raw;
  if (typeof first !== "string") return null;
  const match = /refresh_token=([^;]*)/.exec(first);
  return match?.[1] ?? null;
}

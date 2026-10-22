import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { loadDatabaseConfig } from "../config.js";
import { type Db, createDb } from "./client.js";

/**
 * Locate the folder with the generated SQL migrations (`apps/api/drizzle`).
 * Searched upwards from this module so it works from `src/db` and `dist/src/db`.
 */
export function findMigrationsFolder(
  startDir: string = dirname(fileURLToPath(import.meta.url)),
): string {
  let dir = startDir;
  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = join(dir, "drizzle");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`Could not locate the drizzle migrations folder starting from ${startDir}`);
}

/** Folder with the generated SQL migrations (`apps/api/drizzle`). */
export const migrationsFolder = findMigrationsFolder();

/**
 * Apply pending migrations. Idempotent — drizzle tracks applied migrations in
 * `__drizzle_migrations`, so re-running is a no-op.
 */
export function runMigrations(db: Db, folder: string = migrationsFolder): void {
  migrate(db, { migrationsFolder: folder });
}

/** Open the configured database file, migrate it and hand back the handle. */
export function migrateDatabaseFile(path: string): void {
  const { db, sqlite } = createDb(path);
  try {
    runMigrations(db);
  } finally {
    sqlite.close();
  }
}

const invokedDirectly =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1];

if (invokedDirectly) {
  const { databasePath } = loadDatabaseConfig();
  migrateDatabaseFile(databasePath);
  console.log(`migrations applied to ${databasePath}`);
}

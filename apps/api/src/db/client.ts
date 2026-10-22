import Database from "better-sqlite3";
import { type BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export type Db = BetterSQLite3Database<typeof schema>;

/** The 4 pragmas from docs/ARCHITECTURE.md — applied once, when the client is created. */
export const PRAGMAS = [
  "journal_mode = WAL",
  "foreign_keys = ON",
  "busy_timeout = 5000",
  "synchronous = NORMAL",
] as const;

export interface DbHandle {
  db: Db;
  sqlite: Database.Database;
}

/**
 * Open a SQLite database (in-process, WAL) and return the Drizzle client.
 * `:memory:` is used by the test suites.
 */
export function createDb(path: string): DbHandle {
  const sqlite = new Database(path);
  for (const pragma of PRAGMAS) {
    sqlite.pragma(pragma);
  }
  const db = drizzle(sqlite, { schema });
  return { db, sqlite };
}

/** Read a single pragma value (used by tests + diagnostics). */
export function readPragma(sqlite: Database.Database, name: string): unknown {
  const rows = sqlite.pragma(name) as Array<Record<string, unknown>>;
  const first = rows[0];
  if (!first) return undefined;
  return Object.values(first)[0];
}

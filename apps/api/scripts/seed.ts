#!/usr/bin/env node
/**
 * Seed the database (`pnpm --filter api db:seed`).
 * Creates the first admin (`admin`), the demo child (`child1`) and the two base
 * games, then assigns both games to the demo child. Safe to run twice.
 */
import { loadDatabaseConfig } from "../src/config.js";
import { createDb } from "../src/db/client.js";
import { runMigrations } from "../src/db/migrate.js";
import { seedDatabase } from "../src/db/seed.js";

const { databasePath } = loadDatabaseConfig();
const { db, sqlite } = createDb(databasePath);
try {
  runMigrations(db);
  const result = seedDatabase(db);
  console.log(
    `seeded ${databasePath}: +${result.usersCreated} users, +${result.gamesCreated} games, +${result.assignmentsCreated} assignments`,
  );
} finally {
  sqlite.close();
}

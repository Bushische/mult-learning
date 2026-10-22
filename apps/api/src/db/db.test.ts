import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { type DbHandle, createDb, readPragma } from "./client.js";
import { runMigrations } from "./migrate.js";
import { dailyStats, games, matrixStats, userGameAssignments, users } from "./schema.js";
import { seedDatabase } from "./seed.js";

const handles: DbHandle[] = [];

function memoryDb(): DbHandle {
  const handle = createDb(":memory:");
  runMigrations(handle.db);
  handles.push(handle);
  return handle;
}

afterEach(() => {
  for (const handle of handles.splice(0)) {
    handle.sqlite.close();
  }
});

function tableNames(handle: DbHandle): string[] {
  const rows = handle.sqlite
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all() as { name: string }[];
  return rows.map((row) => row.name);
}

describe("T3 — db layer", () => {
  it("case 1: migrate creates the 5 tables and is idempotent", () => {
    const handle = memoryDb();
    const expected = ["daily_stats", "games", "matrix_stats", "user_game_assignments", "users"];
    for (const name of expected) {
      expect(tableNames(handle)).toContain(name);
    }
    expect(tableNames(handle)).toHaveLength(expected.length + 1); // + __drizzle_migrations

    const before = tableNames(handle);
    expect(() => runMigrations(handle.db)).not.toThrow();
    expect(tableNames(handle)).toEqual(before);
  });

  it("case 2: pragmas are applied (WAL + foreign keys)", () => {
    const dir = mkdtempSync(join(tmpdir(), "mult-learning-db-"));
    const file = join(dir, "app.db");
    try {
      const handle = createDb(file);
      handles.push(handle);
      expect(String(readPragma(handle.sqlite, "journal_mode")).toLowerCase()).toBe("wal");
      expect(Number(readPragma(handle.sqlite, "foreign_keys"))).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("case 3: deleting a user cascades assignments + stats rows", () => {
    const handle = memoryDb();
    const db = handle.db;
    const now = new Date();

    const user = db
      .insert(users)
      .values({
        username: "cascade-me",
        pinHash: "x",
        role: "user",
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
    const game = db
      .insert(games)
      .values({
        name: "Cascade Game",
        rangeAMin: 1,
        rangeAMax: 2,
        rangeBMin: 1,
        rangeBMax: 2,
        variantCount: 3,
        baseTimeReward: 10,
        timePenalty: 5,
        maxDailyTime: 3600,
        hintsJson: "[]",
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    db.insert(userGameAssignments).values({ userId: user.id, gameId: game.id }).run();
    db.insert(dailyStats)
      .values({
        userId: user.id,
        date: "2026-01-01",
        totalTries: 1,
        correctTries: 1,
        timeEarnedSeconds: 10,
      })
      .run();
    db.insert(matrixStats)
      .values({ userId: user.id, factorA: 2, factorB: 3, correct: true, timestamp: now })
      .run();

    db.delete(users).where(eq(users.id, user.id)).run();

    expect(db.select().from(userGameAssignments).all()).toHaveLength(0);
    expect(db.select().from(dailyStats).all()).toHaveLength(0);
    expect(db.select().from(matrixStats).all()).toHaveLength(0);
  });

  it("case 4: seed runs twice without creating duplicates", () => {
    const handle = memoryDb();
    const db = handle.db;

    const first = seedDatabase(db);
    expect(first.usersCreated).toBe(2);
    expect(first.gamesCreated).toBe(2);
    expect(first.assignmentsCreated).toBe(2);

    const second = seedDatabase(db);
    expect(second).toEqual({ usersCreated: 0, gamesCreated: 0, assignmentsCreated: 0 });

    expect(db.select().from(users).all()).toHaveLength(2);
    expect(db.select().from(games).all()).toHaveLength(2);
    expect(db.select().from(userGameAssignments).all()).toHaveLength(2);

    const child = db.select().from(users).where(eq(users.username, "child1")).get();
    expect(child?.role).toBe("user");
    const admin = db.select().from(users).where(eq(users.username, "admin")).get();
    expect(admin?.role).toBe("admin");
  });
});

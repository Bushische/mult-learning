import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { Db } from "./client.js";
import { games, userGameAssignments, users } from "./schema.js";

/** Number of bcrypt rounds used for PIN hashes. */
export const BCRYPT_ROUNDS = 10;

export interface SeedUserSpec {
  username: string;
  pin: string;
  role: "admin" | "user";
}

export interface SeedGameSpec {
  name: string;
  rangeA: { min: number; max: number };
  rangeB: { min: number; max: number };
  variantCount: number;
  baseTimeReward: number;
  questionSeconds: number;
  timePenalty: number;
  maxDailyTime: number;
  hints: { factor: number; text: string }[];
}

/** The first admin (username `admin`) + one demo child, per docs/PROJECT.md. */
export const SEED_USERS: SeedUserSpec[] = [
  { username: "admin", pin: "1289", role: "admin" },
  { username: "child1", pin: "2468", role: "user" },
];

/** Two base games with default economics (+10 s / −5 s, cap 3600 s, 3 variants). */
export const SEED_GAMES: SeedGameSpec[] = [
  {
    name: "Easy Twos",
    rangeA: { min: 2, max: 4 },
    rangeB: { min: 1, max: 4 },
    variantCount: 3,
    baseTimeReward: 10,
    questionSeconds: 15,
    timePenalty: 5,
    maxDailyTime: 3600,
    hints: [],
  },
  {
    name: "Mixed Table",
    rangeA: { min: 1, max: 10 },
    rangeB: { min: 1, max: 10 },
    variantCount: 3,
    baseTimeReward: 10,
    questionSeconds: 15,
    timePenalty: 5,
    maxDailyTime: 3600,
    hints: [],
  },
];

export interface SeedResult {
  usersCreated: number;
  gamesCreated: number;
  assignmentsCreated: number;
}

/**
 * Seed the database. Idempotent: users are matched by username, games by name,
 * assignments by (user, game) — running it twice creates no duplicates.
 */
export function seedDatabase(db: Db): SeedResult {
  const result: SeedResult = { usersCreated: 0, gamesCreated: 0, assignmentsCreated: 0 };
  const now = new Date();

  const userIds = new Map<string, string>();
  for (const spec of SEED_USERS) {
    const existing = db.select().from(users).where(eq(users.username, spec.username)).get();
    if (existing) {
      userIds.set(spec.username, existing.id);
      continue;
    }
    const inserted = db
      .insert(users)
      .values({
        username: spec.username,
        pinHash: bcrypt.hashSync(spec.pin, BCRYPT_ROUNDS),
        role: spec.role,
        timeBankSeconds: 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
    userIds.set(spec.username, inserted.id);
    result.usersCreated += 1;
  }

  const gameIds = new Map<string, string>();
  for (const spec of SEED_GAMES) {
    const existing = db.select().from(games).where(eq(games.name, spec.name)).get();
    if (existing) {
      gameIds.set(spec.name, existing.id);
      continue;
    }
    const inserted = db
      .insert(games)
      .values({
        name: spec.name,
        rangeAMin: spec.rangeA.min,
        rangeAMax: spec.rangeA.max,
        rangeBMin: spec.rangeB.min,
        rangeBMax: spec.rangeB.max,
        allowedCombinationsJson: null,
        variantCount: spec.variantCount,
        baseTimeReward: spec.baseTimeReward,
        questionSeconds: spec.questionSeconds,
        timePenalty: spec.timePenalty,
        maxDailyTime: spec.maxDailyTime,
        hintsJson: JSON.stringify(spec.hints),
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
    gameIds.set(spec.name, inserted.id);
    result.gamesCreated += 1;
  }

  const childId = userIds.get("child1");
  if (childId) {
    for (const spec of SEED_GAMES) {
      const gameId = gameIds.get(spec.name);
      if (!gameId) continue;
      const existing = db
        .select()
        .from(userGameAssignments)
        .where(eq(userGameAssignments.userId, childId))
        .all()
        .find((row) => row.gameId === gameId);
      if (existing) continue;
      db.insert(userGameAssignments).values({ userId: childId, gameId }).run();
      result.assignmentsCreated += 1;
    }
  }

  return result;
}

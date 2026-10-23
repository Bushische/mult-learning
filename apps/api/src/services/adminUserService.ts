import type { AdminUser, CreateUserRequest, UpdateUserRequest } from "@mult/shared";
import bcrypt from "bcryptjs";
import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import {
  type User,
  dailyStats,
  gameDailyStats,
  games,
  matrixStats,
  refreshTokens,
  userGameAssignments,
  users,
} from "../db/schema.js";
import { BCRYPT_ROUNDS } from "../db/seed.js";
import { conflict, notFound } from "../errors.js";

/** All users with their assigned game ids (admin view). */
export function listAdminUsers(db: Db): AdminUser[] {
  const rows = db.select().from(users).all();
  const assignments = db.select().from(userGameAssignments).all();
  return rows.map((user) => ({
    id: user.id,
    username: user.username,
    role: user.role,
    timeBankSeconds: user.timeBankSeconds,
    games: assignments
      .filter((assignment) => assignment.userId === user.id)
      .map((assignment) => assignment.gameId),
    createdAt: user.createdAt.toISOString(),
  }));
}

export function toAdminUser(db: Db, user: User): AdminUser {
  const assignments = db
    .select()
    .from(userGameAssignments)
    .where(eq(userGameAssignments.userId, user.id))
    .all();
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    timeBankSeconds: user.timeBankSeconds,
    games: assignments.map((assignment) => assignment.gameId),
    createdAt: user.createdAt.toISOString(),
  };
}

function assertUsernameFree(db: Db, username: string, exceptUserId?: string): void {
  const existing = db.select().from(users).where(eq(users.username, username)).get();
  if (existing && existing.id !== exceptUserId) {
    throw conflict(`Username "${username}" is already taken`);
  }
}

/** Create a user (admin). */
export function createUser(db: Db, request: CreateUserRequest): AdminUser {
  assertUsernameFree(db, request.username);
  const now = new Date();
  const inserted = db
    .insert(users)
    .values({
      username: request.username,
      pinHash: bcrypt.hashSync(request.pin, BCRYPT_ROUNDS),
      role: request.role ?? "user",
      timeBankSeconds: 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
  return toAdminUser(db, inserted);
}

/** Update a user (admin) — username, PIN and/or role. */
export function updateUser(db: Db, id: string, request: UpdateUserRequest): AdminUser {
  const user = db.select().from(users).where(eq(users.id, id)).get();
  if (!user) throw notFound("User not found");
  if (request.username !== undefined) {
    assertUsernameFree(db, request.username, id);
  }

  const updates: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  if (request.username !== undefined) updates.username = request.username;
  if (request.role !== undefined) updates.role = request.role;
  if (request.pin !== undefined) {
    updates.pinHash = bcrypt.hashSync(request.pin, BCRYPT_ROUNDS);
  }

  const updated = db.update(users).set(updates).where(eq(users.id, id)).returning().get();

  if (request.pin !== undefined) {
    // A new PIN invalidates the refresh sessions of that user.
    db.delete(refreshTokens).where(eq(refreshTokens.userId, id)).run();
  }

  return toAdminUser(db, updated);
}

/** Delete a user (admin) — the last admin cannot be removed. */
export function deleteUser(db: Db, id: string): void {
  const user = db.select().from(users).where(eq(users.id, id)).get();
  if (!user) throw notFound("User not found");
  if (user.role === "admin") {
    const admins = db.select().from(users).where(eq(users.role, "admin")).all();
    if (admins.length <= 1) {
      throw conflict("The last admin cannot be deleted");
    }
  }
  db.delete(users).where(eq(users.id, id)).run();
}

/** Replace the game assignments of a user (admin). */
export function setUserGames(db: Db, id: string, gameIds: string[]): string[] {
  const user = db.select().from(users).where(eq(users.id, id)).get();
  if (!user) throw notFound("User not found");

  const uniqueIds = [...new Set(gameIds)];
  for (const gameId of uniqueIds) {
    const game = db.select().from(games).where(eq(games.id, gameId)).get();
    if (!game) throw notFound(`Game ${gameId} not found`);
  }

  db.transaction((tx) => {
    tx.delete(userGameAssignments).where(eq(userGameAssignments.userId, id)).run();
    for (const gameId of uniqueIds) {
      tx.insert(userGameAssignments).values({ userId: id, gameId }).run();
    }
  });

  return uniqueIds;
}

/** Reset the progress of a user: stats wiped, time bank zeroed (one transaction). */
export function resetUserProgress(db: Db, id: string): void {
  const user = db.select().from(users).where(eq(users.id, id)).get();
  if (!user) throw notFound("User not found");
  db.transaction((tx) => {
    tx.delete(matrixStats).where(eq(matrixStats.userId, id)).run();
    tx.delete(dailyStats).where(eq(dailyStats.userId, id)).run();
    tx.delete(gameDailyStats).where(eq(gameDailyStats.userId, id)).run();
    tx.update(users)
      .set({ timeBankSeconds: 0, updatedAt: new Date() })
      .where(eq(users.id, id))
      .run();
  });
}

/** The ids of the games assigned to one user. */
export function assignedGameIds(db: Db, userId: string): string[] {
  return db
    .select()
    .from(userGameAssignments)
    .where(and(eq(userGameAssignments.userId, userId)))
    .all()
    .map((assignment) => assignment.gameId);
}

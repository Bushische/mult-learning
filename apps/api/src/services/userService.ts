import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { type User, users } from "../db/schema.js";

/** Login grid entry: id + username only (never pins, roles or banks). */
export interface LoginGridUser {
  id: string;
  username: string;
}

export function findUserByUsername(db: Db, username: string): User | undefined {
  return db.select().from(users).where(eq(users.username, username)).get();
}

export function findUserById(db: Db, id: string): User | undefined {
  return db.select().from(users).where(eq(users.id, id)).get();
}

export function listLoginGridUsers(db: Db): LoginGridUser[] {
  return db
    .select({ id: users.id, username: users.username })
    .from(users)
    .all()
    .map((row) => ({ id: row.id, username: row.username }));
}

export function toSessionUser(user: User): {
  id: string;
  username: string;
  role: "admin" | "user";
} {
  return { id: user.id, username: user.username, role: user.role };
}

export function toMe(user: User): {
  id: string;
  username: string;
  role: "admin" | "user";
  timeBankSeconds: number;
} {
  return { ...toSessionUser(user), timeBankSeconds: user.timeBankSeconds };
}

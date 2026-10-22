import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { refreshTokens, users } from "../db/schema.js";
import { unauthorized } from "../errors.js";
import { signAccessToken } from "../plugins/auth.js";
import { findUserByUsername, toSessionUser } from "./userService.js";

/** Cookie name for the rotating refresh token. */
export const REFRESH_COOKIE_NAME = "refresh_token";
/** Cookie path — the refresh cookie is only sent to the auth routes. */
export const REFRESH_COOKIE_PATH = "/api/auth";
/** Refresh token lifetime: 30 days. */
export const REFRESH_TTL_SECONDS = 30 * 24 * 60 * 60;
/** Access token lifetime: 15 minutes. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** A valid bcrypt hash of an unused PIN — used to keep the timing of unknown users similar. */
const DUMMY_PIN_HASH = "$2a$10$x0/2kCVszShGsJ.oH4xPHuNkTVtrUilgRsIi.eKg6tXzdOs5Irv1m";

export interface SessionUserDto {
  id: string;
  username: string;
  role: "admin" | "user";
}

export interface AuthResult {
  accessToken: string;
  user: SessionUserDto;
  refreshToken: string;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateRefreshToken(): string {
  return randomBytes(32).toString("hex");
}

/** Persist a refresh token (only its sha256 hash) for a user. */
export function storeRefreshToken(db: Db, userId: string, token: string): void {
  db.insert(refreshTokens)
    .values({
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
      createdAt: new Date(),
    })
    .run();
}

/** Look up a refresh token row by its raw value (hashed lookup). */
export function findRefreshToken(db: Db, token: string) {
  return db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashToken(token)))
    .get();
}

/** Rotate: the old token is deleted, a fresh one is stored. */
export function rotateRefreshToken(db: Db, oldToken: string, userId: string): string {
  db.delete(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashToken(oldToken)))
    .run();
  const next = generateRefreshToken();
  storeRefreshToken(db, userId, next);
  return next;
}

/** Revoke a refresh token (logout). */
export function revokeRefreshToken(db: Db, token: string): void {
  db.delete(refreshTokens)
    .where(eq(refreshTokens.tokenHash, hashToken(token)))
    .run();
}

/** Verify a username + 4-digit PIN. Returns null for unknown user / wrong PIN. */
export function verifyCredentials(db: Db, username: string, pin: string): SessionUserDto | null {
  const user = findUserByUsername(db, username);
  if (!user) {
    // Keep the timing similar for unknown users (no user enumeration).
    bcrypt.compareSync(pin, DUMMY_PIN_HASH);
    return null;
  }
  if (!bcrypt.compareSync(pin, user.pinHash)) return null;
  return toSessionUser(user);
}

/** Login: issues an access token + a refresh token (stored hashed). */
export function login(db: Db, jwtSecret: string, username: string, pin: string): AuthResult {
  const user = verifyCredentials(db, username, pin);
  if (!user) throw unauthorized("Invalid username or PIN");
  const refreshToken = generateRefreshToken();
  storeRefreshToken(db, user.id, refreshToken);
  return { accessToken: signAccessToken(user, jwtSecret), user, refreshToken };
}

/** Refresh: rotates the refresh cookie and issues a fresh access token. */
export function refresh(db: Db, jwtSecret: string, rawToken: string): AuthResult {
  const stored = findRefreshToken(db, rawToken);
  if (!stored) throw unauthorized("Invalid refresh token");
  if (stored.expiresAt.getTime() <= Date.now()) {
    revokeRefreshToken(db, rawToken);
    throw unauthorized("Refresh token expired");
  }
  const user = db.select().from(users).where(eq(users.id, stored.userId)).get();
  if (!user) {
    revokeRefreshToken(db, rawToken);
    throw unauthorized("Unknown user");
  }
  const sessionUser = toSessionUser(user);
  const nextRefreshToken = rotateRefreshToken(db, rawToken, user.id);
  return {
    accessToken: signAccessToken(sessionUser, jwtSecret),
    user: sessionUser,
    refreshToken: nextRefreshToken,
  };
}

/** Logout: revokes the refresh token (best effort). */
export function logout(db: Db, rawToken: string | undefined): void {
  if (!rawToken) return;
  revokeRefreshToken(db, rawToken);
}

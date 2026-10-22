import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { users } from "../db/schema.js";
import { unauthorized } from "../errors.js";

/** The authenticated caller (filled by `requireAuth`). */
export interface AuthUser {
  id: string;
  username: string;
  role: "admin" | "user";
}

declare module "fastify" {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

/** Access token payload — `{ sub, role }` (docs/API.md). */
export interface AccessTokenPayload {
  sub: string;
  role: "admin" | "user";
}

/**
 * Per-user signing secret: derived from the PIN hash, so changing a PIN
 * invalidates the access tokens issued for the old PIN.
 */
export function tokenSecret(pinHash: string, baseSecret: string): string {
  return createHmac("sha256", baseSecret).update(pinHash).digest("hex");
}

export function signAccessToken(
  user: { id: string; role: "admin" | "user" },
  pinHash: string,
  baseSecret: string,
): string {
  const payload: AccessTokenPayload = { sub: user.id, role: user.role };
  return jwt.sign(payload, tokenSecret(pinHash, baseSecret), { expiresIn: "15m" });
}

/** Verify an access token against the user's current PIN hash. */
export function verifyAccessToken(
  token: string,
  pinHash: string,
  baseSecret: string,
): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, tokenSecret(pinHash, baseSecret)) as jwt.JwtPayload;
    if (typeof decoded.sub !== "string") return null;
    const role = decoded.role === "admin" ? "admin" : "user";
    return { sub: decoded.sub, role };
  } catch {
    return null;
  }
}

/** Read the subject of a token without verifying it (used to find the user). */
export function readTokenSubject(token: string): string | null {
  try {
    const decoded = jwt.decode(token) as jwt.JwtPayload | null;
    return typeof decoded?.sub === "string" ? decoded.sub : null;
  } catch {
    return null;
  }
}

function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

/**
 * Guard for every authenticated endpoint. Verifies the access token and loads
 * the user row (so deleted users and changed PINs lose access immediately).
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = bearerToken(request);
  if (!token) {
    await reply.code(401).send({
      error: { code: "UNAUTHORIZED", message: "Missing access token" },
    });
    return;
  }
  const subject = readTokenSubject(token);
  if (!subject) {
    await reply.code(401).send({
      error: { code: "UNAUTHORIZED", message: "Invalid or expired access token" },
    });
    return;
  }
  const user = request.server.db.select().from(users).where(eq(users.id, subject)).get();
  if (!user) {
    await reply.code(401).send({
      error: { code: "UNAUTHORIZED", message: "Unknown user" },
    });
    return;
  }
  const payload = verifyAccessToken(token, user.pinHash, request.server.config.jwtSecret);
  if (!payload) {
    await reply.code(401).send({
      error: { code: "UNAUTHORIZED", message: "Invalid or expired access token" },
    });
    return;
  }
  request.authUser = { id: user.id, username: user.username, role: user.role };
}

/**
 * The authenticated caller. Throws when the route was not protected by
 * `requireAuth`.
 */
export function requireAuthUser(request: FastifyRequest): AuthUser {
  if (!request.authUser) {
    throw unauthorized("Authentication required");
  }
  return request.authUser;
}

/**
 * Admin guard — re-reads the users row so role changes take effect without
 * waiting for the access token to expire.
 */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAuth(request, reply);
  if (reply.sent) return;
  const role = request.authUser?.role;
  if (role !== "admin") {
    await reply.code(403).send({
      error: { code: "FORBIDDEN", message: "Admin role required" },
    });
  }
}

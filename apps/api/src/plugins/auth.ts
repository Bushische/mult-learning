import { eq } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";
import jwt from "jsonwebtoken";
import { users } from "../db/schema.js";

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

export function signAccessToken(user: AuthUser, secret: string): string {
  const payload: AccessTokenPayload = { sub: user.id, role: user.role };
  return jwt.sign(payload, secret, { expiresIn: "15m" });
}

export function verifyAccessToken(token: string, secret: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, secret) as jwt.JwtPayload;
    if (typeof decoded.sub !== "string") return null;
    const role = decoded.role === "admin" ? "admin" : "user";
    return { sub: decoded.sub, role };
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
 * the user row (so deleted users lose access immediately).
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const token = bearerToken(request);
  if (!token) {
    await reply.code(401).send({
      error: { code: "UNAUTHORIZED", message: "Missing access token" },
    });
    return;
  }
  const payload = verifyAccessToken(token, request.server.config.jwtSecret);
  if (!payload) {
    await reply.code(401).send({
      error: { code: "UNAUTHORIZED", message: "Invalid or expired access token" },
    });
    return;
  }
  const user = request.server.db.select().from(users).where(eq(users.id, payload.sub)).get();
  if (!user) {
    await reply.code(401).send({
      error: { code: "UNAUTHORIZED", message: "Unknown user" },
    });
    return;
  }
  request.authUser = { id: user.id, username: user.username, role: user.role };
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

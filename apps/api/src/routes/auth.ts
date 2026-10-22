import type { FastifyInstance, FastifyReply } from "fastify";
import {
  loginRequestSchema,
  loginResponseSchema,
  logoutResponseSchema,
  refreshResponseSchema,
} from "packages/shared";
import {
  REFRESH_COOKIE_NAME,
  REFRESH_COOKIE_PATH,
  REFRESH_TTL_SECONDS,
  login,
  logout,
  refresh,
} from "../services/authService.js";
import { parseOrThrow } from "../validation.js";

function setRefreshCookie(app: FastifyInstance, reply: FastifyReply, token: string): void {
  reply.setCookie(REFRESH_COOKIE_NAME, token, {
    path: REFRESH_COOKIE_PATH,
    httpOnly: true,
    secure: app.config.nodeEnv === "production",
    sameSite: "strict",
    maxAge: REFRESH_TTL_SECONDS,
  });
}

function clearRefreshCookie(app: FastifyInstance, reply: FastifyReply): void {
  reply.clearCookie(REFRESH_COOKIE_NAME, {
    path: REFRESH_COOKIE_PATH,
    httpOnly: true,
    secure: app.config.nodeEnv === "production",
    sameSite: "strict",
  });
}

/** Auth routes — mounted under `/api/auth`. */
export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/login", async (request, reply) => {
    const body = parseOrThrow(loginRequestSchema, request.body);
    const result = login(app.db, app.config.jwtSecret, body.username, body.pin);
    setRefreshCookie(app, reply, result.refreshToken);
    return loginResponseSchema.parse({
      accessToken: result.accessToken,
      user: result.user,
    });
  });

  app.post("/refresh", async (request, reply) => {
    const token = request.cookies[REFRESH_COOKIE_NAME];
    if (!token) {
      return reply
        .code(401)
        .send({ error: { code: "UNAUTHORIZED", message: "Missing refresh token" } });
    }
    const result = refresh(app.db, app.config.jwtSecret, token);
    setRefreshCookie(app, reply, result.refreshToken);
    return refreshResponseSchema.parse({
      accessToken: result.accessToken,
      user: result.user,
    });
  });

  app.post("/logout", async (request, reply) => {
    logout(app.db, request.cookies[REFRESH_COOKIE_NAME]);
    clearRefreshCookie(app, reply);
    return logoutResponseSchema.parse({ ok: true });
  });
}

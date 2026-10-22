import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import { type AppConfig, loadConfig } from "./config.js";
import { type Db, createDb } from "./db/client.js";
import { registerErrorHandler } from "./plugins/error-handler.js";
import { adminGameRoutes } from "./routes/admin/games.js";
import { adminUserRoutes } from "./routes/admin/users.js";
import { answerRoutes } from "./routes/answers.js";
import { authRoutes } from "./routes/auth.js";
import { gameRoutes } from "./routes/games.js";
import { statsRoutes } from "./routes/stats.js";
import { userRoutes } from "./routes/users.js";

export const healthResponseSchema = z.object({ status: z.literal("ok") });
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export interface BuildAppOptions {
  config?: AppConfig;
  /** `false` disables the pino logger (used by tests). */
  logger?: boolean;
  /** Drizzle client. Defaults to a fresh in-memory database (test convenience). */
  db?: Db;
}

/** Build the Fastify instance: plugins, error contract, routes. */
export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  const quiet = options.logger === false;
  const db = options.db ?? createDb(":memory:").db;

  const app = Fastify({
    logger: quiet ? false : { level: config.logLevel },
  });

  app.decorate("db", db);
  app.decorate("config", config);

  await app.register(cors, {
    origin: config.corsOrigins ?? true,
    credentials: true,
  });
  await app.register(cookie);

  registerErrorHandler(app);

  const health = async (): Promise<HealthResponse> => healthResponseSchema.parse({ status: "ok" });
  app.get("/health", health);
  app.get("/api/health", health);

  await app.register(userRoutes, { prefix: "/api" });
  await app.register(authRoutes, { prefix: "/api/auth" });
  await app.register(gameRoutes, { prefix: "/api" });
  await app.register(answerRoutes, { prefix: "/api" });
  await app.register(statsRoutes, { prefix: "/api" });
  await app.register(adminUserRoutes, { prefix: "/api/admin" });
  await app.register(adminGameRoutes, { prefix: "/api/admin" });

  return app;
}

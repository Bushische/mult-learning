import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import { type AppConfig, loadConfig } from "./config.js";
import { registerErrorHandler } from "./plugins/error-handler.js";

export const healthResponseSchema = z.object({ status: z.literal("ok") });
export type HealthResponse = z.infer<typeof healthResponseSchema>;

export interface BuildAppOptions {
  config?: AppConfig;
  /** `false` disables the pino logger (used by tests). */
  logger?: boolean;
}

/** Build the Fastify instance: plugins, error contract, routes. */
export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const config = options.config ?? loadConfig();
  const quiet = options.logger === false;

  const app = Fastify({
    logger: quiet ? false : { level: config.logLevel },
  });

  await app.register(cors, {
    origin: config.corsOrigins ?? true,
    credentials: true,
  });
  await app.register(cookie);

  registerErrorHandler(app);

  const health = async (): Promise<HealthResponse> => healthResponseSchema.parse({ status: "ok" });
  app.get("/health", health);
  app.get("/api/health", health);

  return app;
}

import type { AppConfig } from "./config.js";
import type { Db } from "./db/client.js";

declare module "fastify" {
  interface FastifyInstance {
    /** Drizzle client (SQLite in-process). */
    db: Db;
    /** Validated runtime configuration. */
    config: AppConfig;
  }
}

import type { Db } from "./db/client.js";

declare module "fastify" {
  interface FastifyInstance {
    /** Drizzle client (SQLite in-process). */
    db: Db;
  }
}

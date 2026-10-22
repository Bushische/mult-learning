import { buildApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createDb } from "./db/client.js";
import { runMigrations } from "./db/migrate.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const { db, sqlite } = createDb(config.databasePath);
  runMigrations(db);

  const app = await buildApp({ config, db });

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, "shutting down");
    await app.close();
    sqlite.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  try {
    await app.listen({ host: config.host, port: config.port });
  } catch (error) {
    app.log.error(error);
    sqlite.close();
    process.exit(1);
  }
}

void main();

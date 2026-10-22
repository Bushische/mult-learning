import { z } from "zod";

/**
 * Runtime configuration, validated with zod at boot (docs/CONVENTIONS.md).
 * Every env var the api needs is declared here — nothing else reads process.env.
 */

const portSchema = z
  .string()
  .regex(/^\d+$/, "PORT must be a number")
  .transform((value) => Number.parseInt(value, 10))
  .pipe(z.number().int().min(1).max(65535));

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().min(1).default("0.0.0.0"),
  PORT: portSchema,
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  JWT_SECRET: z.string().min(8, "JWT_SECRET must be at least 8 characters long"),
  DATABASE_PATH: z.string().min(1).default("./data/app.db"),
  /** Comma separated origin allowlist. Unset = reflect any origin (credentials allowed). */
  CORS_ORIGIN: z.string().optional(),
});

export type AppConfig = {
  nodeEnv: "development" | "test" | "production";
  host: string;
  port: number;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
  jwtSecret: string;
  databasePath: string;
  corsOrigins: string[] | null;
};

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/** Config subset needed by the db scripts (no server settings required). */
export const databaseEnvSchema = z.object({
  DATABASE_PATH: envSchema.shape.DATABASE_PATH,
});

/** Load only the database settings (used by `db:migrate` / `db:seed`). */
export function loadDatabaseConfig(env: NodeJS.ProcessEnv = process.env): {
  databasePath: string;
} {
  const parsed = databaseEnvSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new ConfigError(`Invalid environment configuration — ${details}`);
  }
  return { databasePath: parsed.data.DATABASE_PATH };
}

/** Parse + validate the environment. Throws a readable `ConfigError` on bad input. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new ConfigError(`Invalid environment configuration — ${details}`);
  }
  const { NODE_ENV, HOST, PORT, LOG_LEVEL, JWT_SECRET, DATABASE_PATH, CORS_ORIGIN } = parsed.data;
  const corsOrigins =
    CORS_ORIGIN && CORS_ORIGIN.trim().length > 0
      ? CORS_ORIGIN.split(",")
          .map((origin) => origin.trim())
          .filter((origin) => origin.length > 0)
      : null;
  return {
    nodeEnv: NODE_ENV,
    host: HOST,
    port: PORT,
    logLevel: LOG_LEVEL,
    jwtSecret: JWT_SECRET,
    databasePath: DATABASE_PATH,
    corsOrigins,
  };
}

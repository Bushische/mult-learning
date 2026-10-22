import { describe, expect, it } from "vitest";
import { ConfigError, loadConfig } from "./config.js";

const baseEnv = {
  NODE_ENV: "test",
  HOST: "127.0.0.1",
  PORT: "3000",
  LOG_LEVEL: "info",
  JWT_SECRET: "a-long-enough-secret",
  DATABASE_PATH: ":memory:",
};

describe("T2 — configuration", () => {
  it("case 4: missing PORT fails validation with a readable error", () => {
    const withoutPort: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      HOST: "127.0.0.1",
      LOG_LEVEL: "info",
      JWT_SECRET: "a-long-enough-secret",
      DATABASE_PATH: ":memory:",
    };
    let thrown: unknown;
    try {
      loadConfig(withoutPort);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(ConfigError);
    expect((thrown as ConfigError).message).toContain("PORT");
    expect((thrown as ConfigError).message).toContain("Invalid environment configuration");
  });

  it("parses a valid environment", () => {
    const config = loadConfig(baseEnv);
    expect(config.port).toBe(3000);
    expect(config.host).toBe("127.0.0.1");
    expect(config.jwtSecret).toBe("a-long-enough-secret");
    expect(config.corsOrigins).toBeNull();
  });
});

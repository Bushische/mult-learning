import { describe, expect, it } from "vitest";
import { buildApp } from "./app.js";
import { FastifyHttpError } from "./errors.js";
import { testConfig } from "./test/helper.js";

describe("T2 — api bootstrap", () => {
  it("case 1: GET /health returns 200 {status:'ok'} without auth", async () => {
    const app = await buildApp({ config: testConfig, logger: false });
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
    await app.close();
  });

  it("case 2: unknown route returns 404 with the error envelope", async () => {
    const app = await buildApp({ config: testConfig, logger: false });
    const response = await app.inject({ method: "GET", url: "/api/nope" });
    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body.error.code).toBe("NOT_FOUND");
    expect(typeof body.error.message).toBe("string");
    await app.close();
  });

  it("case 3: FastifyHttpError maps to its status + code", async () => {
    const app = await buildApp({ config: testConfig, logger: false });
    app.get("/api/test-conflict", async () => {
      throw new FastifyHttpError(409, "CONFLICT", "Username already exists");
    });
    const response = await app.inject({ method: "GET", url: "/api/test-conflict" });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: { code: "CONFLICT", message: "Username already exists" },
    });
    await app.close();
  });
});

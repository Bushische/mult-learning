import jwt from "jsonwebtoken";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { requireAdmin } from "../plugins/auth.js";
import { type TestApp, createTestApp, readRefreshCookie, testConfig } from "../test/helper.js";

let ctx: TestApp;

beforeEach(async () => {
  ctx = await createTestApp();
});

afterEach(async () => {
  await ctx.close();
});

async function loginAs(username: string, pin: string) {
  const response = await ctx.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username, pin },
  });
  return response;
}

describe("T4 — auth", () => {
  it("case 1: login with the seeded admin returns an access token, the role and a refresh cookie", async () => {
    const response = await loginAs("admin", "1289");
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(typeof body.accessToken).toBe("string");
    expect(body.user).toMatchObject({ username: "admin", role: "admin" });
    expect(body.user.pinHash).toBeUndefined();

    const cookie = readRefreshCookie(response.headers);
    expect(cookie).toBeTruthy();
    const setCookie = String(response.headers["set-cookie"]);
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Path=/api/auth");
    expect(setCookie).toContain("SameSite=Strict");
  });

  it("case 2: a wrong PIN returns 401 UNAUTHORIZED and sets no cookie", async () => {
    const response = await loginAs("admin", "0000");
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("UNAUTHORIZED");
    expect(response.headers["set-cookie"]).toBeUndefined();
  });

  it("case 3: GET /users is public but exposes only ids and usernames", async () => {
    const response = await ctx.app.inject({ method: "GET", url: "/api/users" });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.map((entry: { username: string }) => entry.username)).toEqual(
      expect.arrayContaining(["admin", "child1"]),
    );
    for (const entry of body) {
      expect(Object.keys(entry).sort()).toEqual(["id", "username"]);
    }
  });

  it("case 4: GET /me rejects an invalid/expired token and returns the profile for a valid one", async () => {
    const invalid = await ctx.app.inject({
      method: "GET",
      url: "/api/me",
      headers: { authorization: "Bearer not-a-token" },
    });
    expect(invalid.statusCode).toBe(401);
    expect(invalid.json().error.code).toBe("UNAUTHORIZED");

    const expired = jwt.sign({ sub: "someone", role: "user" }, testConfig.jwtSecret, {
      expiresIn: -60,
    });
    const expiredResponse = await ctx.app.inject({
      method: "GET",
      url: "/api/me",
      headers: { authorization: `Bearer ${expired}` },
    });
    expect(expiredResponse.statusCode).toBe(401);

    const login = await loginAs("child1", "2468");
    const token = login.json().accessToken as string;
    const me = await ctx.app.inject({
      method: "GET",
      url: "/api/me",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ username: "child1", role: "user", timeBankSeconds: 0 });
  });

  it("case 5: an admin-guarded route rejects a child token with 403 FORBIDDEN", async () => {
    ctx.app.get("/api/test-admin", { preHandler: requireAdmin }, async () => ({ ok: true }));

    const child = await loginAs("child1", "2468");
    const childToken = child.json().accessToken as string;
    const forbidden = await ctx.app.inject({
      method: "GET",
      url: "/api/test-admin",
      headers: { authorization: `Bearer ${childToken}` },
    });
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json().error.code).toBe("FORBIDDEN");

    const anonymous = await ctx.app.inject({ method: "GET", url: "/api/test-admin" });
    expect(anonymous.statusCode).toBe(401);

    const admin = await loginAs("admin", "1289");
    const adminToken = admin.json().accessToken as string;
    const allowed = await ctx.app.inject({
      method: "GET",
      url: "/api/test-admin",
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(allowed.statusCode).toBe(200);
  });

  it("case 6: refresh rotates the cookie — the old one stops working", async () => {
    const login = await loginAs("child1", "2468");
    const firstCookie = readRefreshCookie(login.headers);
    expect(firstCookie).toBeTruthy();

    const refreshed = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      headers: { cookie: `refresh_token=${firstCookie}` },
    });
    expect(refreshed.statusCode).toBe(200);
    expect(refreshed.json().accessToken).toBeTruthy();
    const secondCookie = readRefreshCookie(refreshed.headers);
    expect(secondCookie).toBeTruthy();
    expect(secondCookie).not.toBe(firstCookie);

    const reused = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      headers: { cookie: `refresh_token=${firstCookie}` },
    });
    expect(reused.statusCode).toBe(401);
    expect(reused.json().error.code).toBe("UNAUTHORIZED");

    const reusedNew = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      headers: { cookie: `refresh_token=${secondCookie}` },
    });
    expect(reusedNew.statusCode).toBe(200);
  });

  it("case 7: logout revokes the refresh token and clears the cookie", async () => {
    const login = await loginAs("child1", "2468");
    const cookie = readRefreshCookie(login.headers);
    const logout = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: { cookie: `refresh_token=${cookie}` },
    });
    expect(logout.statusCode).toBe(200);
    expect(logout.json()).toEqual({ ok: true });

    const afterLogout = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/refresh",
      headers: { cookie: `refresh_token=${cookie}` },
    });
    expect(afterLogout.statusCode).toBe(401);
  });
});

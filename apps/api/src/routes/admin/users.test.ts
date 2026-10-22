import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { dailyStats, games, matrixStats, userGameAssignments, users } from "../../db/schema.js";
import { type TestApp, createTestApp } from "../../test/helper.js";

let ctx: TestApp;
let adminToken: string;

beforeEach(async () => {
  ctx = await createTestApp();
  const login = await ctx.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: "admin", pin: "1289" },
  });
  adminToken = login.json().accessToken as string;
});

afterEach(async () => {
  await ctx.close();
});

function admin(
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE",
  url: string,
  payload?: Record<string, unknown>,
) {
  return ctx.app.inject({
    method,
    url,
    headers: { authorization: `Bearer ${adminToken}` },
    ...(payload === undefined ? {} : { payload }),
  });
}

describe("T8 — admin users", () => {
  it("case 1: an admin creates a child that can log in immediately", async () => {
    const created = await admin("POST", "/api/admin/users", {
      username: "child2",
      pin: "1357",
      role: "user",
    });
    expect(created.statusCode).toBe(201);
    const body = created.json();
    expect(body).toMatchObject({ username: "child2", role: "user", timeBankSeconds: 0 });
    expect(body.games).toEqual([]);
    expect(typeof body.createdAt).toBe("string");

    const login = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "child2", pin: "1357" },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json().user).toMatchObject({ username: "child2", role: "user" });
  });

  it("case 2: a duplicate username is a 409 CONFLICT on create and on update", async () => {
    const first = await admin("POST", "/api/admin/users", { username: "twin", pin: "1111" });
    expect(first.statusCode).toBe(201);

    const duplicate = await admin("POST", "/api/admin/users", { username: "twin", pin: "2222" });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().error.code).toBe("CONFLICT");

    const other = await admin("POST", "/api/admin/users", { username: "other", pin: "2222" });
    const conflict = await admin("PATCH", `/api/admin/users/${other.json().id}`, {
      username: "twin",
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error.code).toBe("CONFLICT");
  });

  it("case 3: a child token gets 403 and no token gets 401 on admin endpoints", async () => {
    const childLogin = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "child1", pin: "2468" },
    });
    const childToken = childLogin.json().accessToken as string;

    const forbidden = await ctx.app.inject({
      method: "GET",
      url: "/api/admin/users",
      headers: { authorization: `Bearer ${childToken}` },
    });
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json().error.code).toBe("FORBIDDEN");

    const anonymous = await ctx.app.inject({ method: "GET", url: "/api/admin/users" });
    expect(anonymous.statusCode).toBe(401);
  });

  it("case 4: a new PIN replaces the old one and invalidates the old session", async () => {
    const created = await admin("POST", "/api/admin/users", { username: "pinchange", pin: "1111" });
    const id = created.json().id as string;

    const oldLogin = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "pinchange", pin: "1111" },
    });
    expect(oldLogin.statusCode).toBe(200);
    const oldToken = oldLogin.json().accessToken as string;

    const updated = await admin("PATCH", `/api/admin/users/${id}`, { pin: "9999" });
    expect(updated.statusCode).toBe(200);

    const oldPin = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "pinchange", pin: "1111" },
    });
    expect(oldPin.statusCode).toBe(401);

    const newPin = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "pinchange", pin: "9999" },
    });
    expect(newPin.statusCode).toBe(200);

    const oldSession = await ctx.app.inject({
      method: "GET",
      url: "/api/me",
      headers: { authorization: `Bearer ${oldToken}` },
    });
    expect(oldSession.statusCode).toBe(401);
  });

  it("case 5: PUT assignments replaces the set and the child sees the change", async () => {
    const child = ctx.db.select().from(users).where(eq(users.username, "child1")).get();
    const easy = ctx.db.select().from(games).where(eq(games.name, "Easy Twos")).get();
    const mixed = ctx.db.select().from(games).where(eq(games.name, "Mixed Table")).get();

    const before = await ctx.app.inject({
      method: "GET",
      url: "/api/games",
      headers: {
        authorization: `Bearer ${
          (
            await ctx.app.inject({
              method: "POST",
              url: "/api/auth/login",
              payload: { username: "child1", pin: "2468" },
            })
          ).json().accessToken as string
        }`,
      },
    });
    expect(before.json()).toHaveLength(2);

    const assigned = await admin("PUT", `/api/admin/users/${child?.id ?? ""}/games`, {
      gameIds: [mixed?.id ?? ""],
    });
    expect(assigned.statusCode).toBe(200);
    expect(assigned.json()).toEqual([mixed?.id]);

    const login = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "child1", pin: "2468" },
    });
    const after = await ctx.app.inject({
      method: "GET",
      url: "/api/games",
      headers: { authorization: `Bearer ${login.json().accessToken as string}` },
    });
    expect(after.json()).toHaveLength(1);
    expect(after.json()[0].id).toBe(mixed?.id);
    expect(after.json()[0].name).toBe("Mixed Table");
    expect(easy?.id).toBeTruthy();
  });

  it("case 6: reset wipes the bank and the stats", async () => {
    const child = ctx.db.select().from(users).where(eq(users.username, "child1")).get();
    const gameId = ctx.db.select().from(games).where(eq(games.name, "Easy Twos")).get()?.id ?? "";
    const login = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "child1", pin: "2468" },
    });
    const token = login.json().accessToken as string;

    await ctx.app.inject({
      method: "POST",
      url: "/api/answers",
      headers: { authorization: `Bearer ${token}` },
      payload: { gameId, factorA: 2, factorB: 3, chosen: 6, elapsedMs: 0 },
    });

    const reset = await admin("POST", `/api/admin/users/${child?.id ?? ""}/reset`);
    expect(reset.statusCode).toBe(204);

    expect(ctx.db.select().from(matrixStats).all()).toHaveLength(0);
    expect(ctx.db.select().from(dailyStats).all()).toHaveLength(0);
    const user = ctx.db
      .select()
      .from(users)
      .where(eq(users.id, child?.id ?? ""))
      .get();
    expect(user?.timeBankSeconds).toBe(0);

    const daily = await ctx.app.inject({
      method: "GET",
      url: "/api/stats/daily",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(daily.json()).toMatchObject({
      totalTries: 0,
      correctTries: 0,
      timeEarnedSeconds: 0,
      timeBankSeconds: 0,
    });

    const after = await ctx.app.inject({
      method: "POST",
      url: "/api/answers",
      headers: { authorization: `Bearer ${token}` },
      payload: { gameId, factorA: 2, factorB: 3, chosen: 6, elapsedMs: 0 },
    });
    expect(after.json()).toMatchObject({ timeBankSeconds: 10, timeDelta: 10 });
  });

  it("case 7: deleting a user removes their assignments and stats (cascade)", async () => {
    const created = await admin("POST", "/api/admin/users", { username: "temp", pin: "1212" });
    const id = created.json().id as string;
    const gameId = ctx.db.select().from(games).where(eq(games.name, "Easy Twos")).get()?.id ?? "";
    await admin("PUT", `/api/admin/users/${id}/games`, { gameIds: [gameId] });

    ctx.db
      .insert(matrixStats)
      .values({ userId: id, factorA: 2, factorB: 2, correct: true, timestamp: new Date() })
      .run();
    ctx.db
      .insert(dailyStats)
      .values({
        userId: id,
        date: "2026-01-01",
        totalTries: 1,
        correctTries: 1,
        timeEarnedSeconds: 5,
      })
      .run();

    const deleted = await admin("DELETE", `/api/admin/users/${id}`);
    expect(deleted.statusCode).toBe(204);

    expect(ctx.db.select().from(users).where(eq(users.id, id)).all()).toHaveLength(0);
    expect(
      ctx.db.select().from(userGameAssignments).where(eq(userGameAssignments.userId, id)).all(),
    ).toHaveLength(0);
    expect(ctx.db.select().from(matrixStats).where(eq(matrixStats.userId, id)).all()).toHaveLength(
      0,
    );
    expect(ctx.db.select().from(dailyStats).where(eq(dailyStats.userId, id)).all()).toHaveLength(0);
  });

  it("case 8: the last admin cannot be deleted", async () => {
    const admins = ctx.db.select().from(users).where(eq(users.role, "admin")).all();
    expect(admins).toHaveLength(1);
    const deleted = await admin("DELETE", `/api/admin/users/${admins[0]?.id ?? ""}`);
    expect(deleted.statusCode).toBe(409);
    expect(deleted.json().error.code).toBe("CONFLICT");
  });
});

describe("T20 — admin child stats", () => {
  it("case 1+4: totals match the daily sums and out-of-range cells never appear", async () => {
    const child = ctx.db.select().from(users).where(eq(users.username, "child1")).get();
    const childId = child?.id ?? "";
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    ctx.db
      .insert(dailyStats)
      .values([
        { userId: childId, date: today, totalTries: 10, correctTries: 7, timeEarnedSeconds: 50 },
        { userId: childId, date: yesterday, totalTries: 4, correctTries: 4, timeEarnedSeconds: 20 },
        {
          userId: childId,
          date: eightDaysAgo,
          totalTries: 100,
          correctTries: 100,
          timeEarnedSeconds: 1000,
        },
      ])
      .run();
    ctx.db
      .insert(matrixStats)
      .values([
        {
          userId: childId,
          factorA: 2,
          factorB: 5,
          correct: true,
          timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        },
        {
          userId: childId,
          factorA: 20,
          factorB: 20,
          correct: true,
          timestamp: new Date(),
        },
        {
          userId: childId,
          factorA: 3,
          factorB: 3,
          correct: false,
          timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
        },
      ])
      .run();

    const response = await admin("GET", `/api/admin/users/${childId}/stats`);
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.user).toMatchObject({ id: childId, username: "child1" });
    expect(typeof body.user.timeBankSeconds).toBe("number");
    // the 8-day-old daily row is outside the window
    expect(body.last7Days).toMatchObject({
      attempts: 14,
      correct: 11,
      incorrect: 3,
      earnedSeconds: 70,
    });
    // the 2-day-old matrix row is present, the 8-day-old one is gone
    const cell = body.heatmap.find(
      (entry: { a: number; b: number }) => entry.a === 2 && entry.b === 5,
    );
    expect(cell).toMatchObject({ tries: 1, correct: 1, accuracy: 1, color: "green" });
    const stale = body.heatmap.find(
      (entry: { a: number; b: number }) => entry.a === 3 && entry.b === 3,
    );
    expect(stale).toMatchObject({ tries: 0, color: "none" });
    // (20, 20) is outside the child's assigned ranges and never appears
    expect(
      body.heatmap.some((entry: { a: number; b: number }) => entry.a === 20 && entry.b === 20),
    ).toBe(false);
  });

  it("case 3: no activity renders an all-none heatmap and zero totals", async () => {
    const created = await admin("POST", "/api/admin/users", { username: "quiet", pin: "5555" });
    const id = created.json().id as string;
    const easy = ctx.db.select().from(games).where(eq(games.name, "Easy Twos")).get();
    await admin("PUT", `/api/admin/users/${id}/games`, { gameIds: [easy?.id ?? ""] });

    const response = await admin("GET", `/api/admin/users/${id}/stats`);
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.last7Days).toMatchObject({
      attempts: 0,
      correct: 0,
      incorrect: 0,
      earnedSeconds: 0,
    });
    expect(body.heatmap.length).toBeGreaterThan(0);
    expect(body.heatmap.every((cell: { color: string }) => cell.color === "none")).toBe(true);
  });

  it("case 5: a child token gets 403 and an unknown user gets 404", async () => {
    const childLogin = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "child1", pin: "2468" },
    });
    const childToken = childLogin.json().accessToken as string;

    const child = ctx.db.select().from(users).where(eq(users.username, "child1")).get();
    const forbidden = await ctx.app.inject({
      method: "GET",
      url: `/api/admin/users/${child?.id ?? ""}/stats`,
      headers: { authorization: `Bearer ${childToken}` },
    });
    expect(forbidden.statusCode).toBe(403);

    const unknown = await admin("GET", "/api/admin/users/u-nope/stats");
    expect(unknown.statusCode).toBe(404);
    expect(unknown.json().error.code).toBe("NOT_FOUND");

    const anonymous = await ctx.app.inject({
      method: "GET",
      url: `/api/admin/users/${child?.id ?? ""}/stats`,
    });
    expect(anonymous.statusCode).toBe(401);
  });
});

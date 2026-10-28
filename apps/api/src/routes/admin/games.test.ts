import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { dailyStats, games, users } from "../../db/schema.js";
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

const validGame = {
  name: "Hard Sevens",
  rangeA: { min: 2, max: 4 },
  rangeB: { min: 5, max: 8 },
  allowedCombinations: null,
  variantCount: 3,
  baseTimeReward: 10,
  timePenalty: 5,
  maxDailyTime: 3600,
  hints: [{ factor: 10, text: "Just add a 0 at the end!" }],
};

describe("T9 — admin games, leaderboard, daily overview", () => {
  it("case 1: an admin creates a game and an assigned child sees it with all fields", async () => {
    const created = await admin("POST", "/api/admin/games", validGame);
    expect(created.statusCode).toBe(201);
    const game = created.json();
    expect(game).toMatchObject({
      name: "Hard Sevens",
      rangeA: { min: 2, max: 4 },
      rangeB: { min: 5, max: 8 },
      variantCount: 3,
      baseTimeReward: 10,
      timePenalty: 5,
      maxDailyTime: 3600,
      hints: [{ factor: 10, text: "Just add a 0 at the end!" }],
    });

    const child = ctx.db.select().from(users).where(eq(users.username, "child1")).get();
    await admin("PUT", `/api/admin/users/${child?.id ?? ""}/games`, { gameIds: [game.id] });

    const login = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "child1", pin: "2468" },
    });
    const list = await ctx.app.inject({
      method: "GET",
      url: "/api/games",
      headers: { authorization: `Bearer ${login.json().accessToken as string}` },
    });
    const found = list.json().find((entry: { id: string }) => entry.id === game.id);
    expect(found).toMatchObject({
      name: "Hard Sevens",
      rangeA: { min: 2, max: 4 },
      rangeB: { min: 5, max: 8 },
      variantCount: 3,
      baseTimeReward: 10,
      timePenalty: 5,
      maxDailyTime: 3600,
      hints: [{ factor: 10, text: "Just add a 0 at the end!" }],
    });
  });

  it("case 2: an invalid config is a 400 VALIDATION_ERROR and creates nothing", async () => {
    const before = ctx.db.select().from(games).all().length;

    const inverted = await admin("POST", "/api/admin/games", {
      ...validGame,
      rangeA: { min: 8, max: 2 },
    });
    expect(inverted.statusCode).toBe(400);
    expect(inverted.json().error.code).toBe("VALIDATION_ERROR");

    const variants = await admin("POST", "/api/admin/games", { ...validGame, variantCount: 2 });
    expect(variants.statusCode).toBe(400);

    const factor = await admin("POST", "/api/admin/games", {
      ...validGame,
      rangeA: { min: 1, max: 25 },
    });
    expect(factor.statusCode).toBe(400);

    expect(ctx.db.select().from(games).all()).toHaveLength(before);
  });

  it("case 3: PATCH updates the economics, DELETE removes the game + assignments, unknown id is 404", async () => {
    const created = await admin("POST", "/api/admin/games", validGame);
    const id = created.json().id as string;

    const patched = await admin("PATCH", `/api/admin/games/${id}`, {
      baseTimeReward: 20,
      timePenalty: 8,
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toMatchObject({ baseTimeReward: 20, timePenalty: 8 });

    const child = ctx.db.select().from(users).where(eq(users.username, "child1")).get();
    await admin("PUT", `/api/admin/users/${child?.id ?? ""}/games`, { gameIds: [id] });

    const login = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "child1", pin: "2468" },
    });
    const before = await ctx.app.inject({
      method: "GET",
      url: "/api/games",
      headers: { authorization: `Bearer ${login.json().accessToken as string}` },
    });
    expect(before.json().length).toBe(1); // the assignment set was replaced

    const deleted = await admin("DELETE", `/api/admin/games/${id}`);
    expect(deleted.statusCode).toBe(204);

    const after = await ctx.app.inject({
      method: "GET",
      url: "/api/games",
      headers: { authorization: `Bearer ${login.json().accessToken as string}` },
    });
    expect(after.json().length).toBe(0);

    const unknown = await admin("PATCH", "/api/admin/games/nope", { baseTimeReward: 1 });
    expect(unknown.statusCode).toBe(404);
    const unknownDelete = await admin("DELETE", "/api/admin/games/nope");
    expect(unknownDelete.statusCode).toBe(404);
  });

  it("T18 case 1+2: today and 7-day windows rank independently; idle users still listed", async () => {
    const childA = ctx.db.select().from(users).where(eq(users.username, "child1")).get();
    const childB = (
      await admin("POST", "/api/admin/users", { username: "child2", pin: "3333" })
    ).json() as { id: string };
    const childC = (
      await admin("POST", "/api/admin/users", { username: "child3", pin: "4444" })
    ).json() as { id: string };
    const today = new Date().toISOString().slice(0, 10);
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    ctx.db
      .insert(dailyStats)
      .values([
        {
          userId: childA?.id ?? "",
          date: today,
          totalTries: 10,
          correctTries: 8,
          timeEarnedSeconds: 60,
        },
        {
          userId: childA?.id ?? "",
          date: threeDaysAgo,
          totalTries: 5,
          correctTries: 3,
          timeEarnedSeconds: 30,
        },
        {
          userId: childB.id,
          date: today,
          totalTries: 12,
          correctTries: 12,
          timeEarnedSeconds: 120,
        },
        {
          userId: childB.id,
          date: threeDaysAgo,
          totalTries: 20,
          correctTries: 15,
          timeEarnedSeconds: 180,
        },
        {
          userId: childC.id,
          date: threeDaysAgo,
          totalTries: 25,
          correctTries: 20,
          timeEarnedSeconds: 250,
        },
      ])
      .run();

    const leaderboard = await admin("GET", "/api/admin/leaderboard");
    expect(leaderboard.statusCode).toBe(200);
    const payload = leaderboard.json();

    // today: child2 (120) > child1 (60) > admin/child3 (0, still listed, name order)
    expect(payload.today.map((row: { username: string }) => row.username)).toEqual([
      "child2",
      "child1",
      "admin",
      "child3",
    ]);
    expect(payload.today[0]).toMatchObject({
      username: "child2",
      timeEarnedSeconds: 120,
      accuracy: 1,
    });
    expect(
      payload.today.find((row: { username: string }) => row.username === "child3"),
    ).toMatchObject({ timeEarnedSeconds: 0, accuracy: null });

    // last 7 days: child2 (300) > child3 (250) > child1 (90) — independent of today
    expect(payload.last7Days.map((row: { username: string }) => row.username)).toEqual([
      "child2",
      "child3",
      "child1",
      "admin",
    ]);
    expect(payload.last7Days[0]).toMatchObject({
      username: "child2",
      timeEarnedSeconds: 300,
    });
    expect(payload.last7Days[1]).toMatchObject({
      username: "child3",
      timeEarnedSeconds: 250,
      accuracy: 0.8,
    });
    expect(payload.last7Days[2]).toMatchObject({
      username: "child1",
      timeEarnedSeconds: 90,
    });

    // a user with no tries at all has a null accuracy in both windows
    const idleToday = payload.today.find((row: { username: string }) => row.username === "admin");
    expect(idleToday).toMatchObject({ timeEarnedSeconds: 0, accuracy: null });
    const idleWeek = payload.last7Days.find(
      (row: { username: string }) => row.username === "admin",
    );
    expect(idleWeek).toMatchObject({ timeEarnedSeconds: 0, accuracy: null });
  });

  it("T18 case 5: a child token gets 403 and no token gets 401 on the leaderboard", async () => {
    const childLogin = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "child1", pin: "2468" },
    });
    const childToken = childLogin.json().accessToken as string;

    const forbidden = await ctx.app.inject({
      method: "GET",
      url: "/api/admin/leaderboard",
      headers: { authorization: `Bearer ${childToken}` },
    });
    expect(forbidden.statusCode).toBe(403);
    expect(forbidden.json().error.code).toBe("FORBIDDEN");

    const anonymous = await ctx.app.inject({ method: "GET", url: "/api/admin/leaderboard" });
    expect(anonymous.statusCode).toBe(401);
  });

  it("case 5: GET /admin/stats/daily returns the rows of the requested day and rejects children", async () => {
    const child = ctx.db.select().from(users).where(eq(users.username, "child1")).get();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    ctx.db
      .insert(dailyStats)
      .values({
        userId: child?.id ?? "",
        date: yesterday,
        totalTries: 4,
        correctTries: 3,
        timeEarnedSeconds: 20,
      })
      .run();

    const response = await admin("GET", `/api/admin/stats/daily?date=${yesterday}`);
    expect(response.statusCode).toBe(200);
    const row = response.json().find((entry: { username: string }) => entry.username === "child1");
    expect(row).toMatchObject({
      totalTries: 4,
      correctTries: 3,
      timeEarnedSeconds: 20,
    });

    const today = await admin("GET", "/api/admin/stats/daily");
    expect(today.statusCode).toBe(200);
    const todayRow = today
      .json()
      .find((entry: { username: string }) => entry.username === "child1");
    expect(todayRow).toMatchObject({ totalTries: 0, correctTries: 0, timeEarnedSeconds: 0 });

    const childLogin = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "child1", pin: "2468" },
    });
    const forbidden = await ctx.app.inject({
      method: "GET",
      url: "/api/admin/stats/daily",
      headers: { authorization: `Bearer ${childLogin.json().accessToken as string}` },
    });
    expect(forbidden.statusCode).toBe(403);
  });
});

describe("T23 — questionSeconds contract", () => {
  it("case 5: 4 and 61 are rejected, 5..60 accepted, omitted defaults to 15", async () => {
    for (const questionSeconds of [4, 61]) {
      const bad = await admin("POST", "/api/admin/games", { ...validGame, questionSeconds });
      expect(bad.statusCode).toBe(400);
      expect(bad.json().error.code).toBe("VALIDATION_ERROR");
    }
    for (const questionSeconds of [5, 60]) {
      const ok = await admin("POST", "/api/admin/games", {
        ...validGame,
        name: `QS ${questionSeconds}`,
        questionSeconds,
      });
      expect(ok.statusCode).toBe(201);
      expect(ok.json()).toMatchObject({ questionSeconds });
    }

    const fresh = await admin("POST", "/api/admin/games", { ...validGame, name: "QS default" });
    expect(fresh.statusCode).toBe(201);
    expect(fresh.json()).toMatchObject({ questionSeconds: 15 });

    const id = fresh.json().id as string;
    const badPatch = await admin("PATCH", `/api/admin/games/${id}`, { questionSeconds: 61 });
    expect(badPatch.statusCode).toBe(400);
    const okPatch = await admin("PATCH", `/api/admin/games/${id}`, { questionSeconds: 20 });
    expect(okPatch.statusCode).toBe(200);
    expect(okPatch.json()).toMatchObject({ questionSeconds: 20 });
  });
});

describe("T47 — operations in the admin games API", () => {
  it("creates a mixed-operations game, patches its list, and rejects an empty list", async () => {
    const created = await admin("POST", "/api/admin/games", {
      ...validGame,
      name: "Plus and Minus",
      operations: ["add", "sub"],
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ operations: ["add", "sub"] });

    const game = created.json() as { id: string };
    const listed = await admin("GET", "/api/admin/games");
    expect(
      (listed.json() as { id: string; operations: string[] }[]).find((entry) => entry.id === game.id),
    ).toMatchObject({ operations: ["add", "sub"] });

    const patched = await admin("PATCH", `/api/admin/games/${game.id}`, {
      operations: ["add", "sub", "mul", "div"],
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json()).toMatchObject({ operations: ["add", "sub", "mul", "div"] });

    const empty = await admin("POST", "/api/admin/games", {
      ...validGame,
      name: "No Ops",
      operations: [],
    });
    expect(empty.statusCode).toBe(400);
  });
});

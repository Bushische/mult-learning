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

  it("case 4: the leaderboard ranks by 7-day earned time and reports accuracy", async () => {
    const child = ctx.db.select().from(users).where(eq(users.username, "child1")).get();
    const today = new Date().toISOString().slice(0, 10);
    ctx.db
      .insert(dailyStats)
      .values({
        userId: child?.id ?? "",
        date: today,
        totalTries: 10,
        correctTries: 8,
        timeEarnedSeconds: 45,
      })
      .run();

    const leaderboard = await admin("GET", "/api/admin/leaderboard");
    expect(leaderboard.statusCode).toBe(200);
    const rows = leaderboard.json();
    const first = rows[0];
    expect(first).toMatchObject({ username: "child1", timeEarnedSeconds: 45, accuracy: 0.8 });
    const idle = rows.find((row: { username: string }) => row.username === "admin");
    expect(idle).toMatchObject({ timeEarnedSeconds: 0, accuracy: null });
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

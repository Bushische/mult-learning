import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { games, matrixStats, userGameAssignments, users } from "../db/schema.js";
import { type TestApp, createTestApp } from "../test/helper.js";

let ctx: TestApp;
let token: string;
let userId: string;

beforeEach(async () => {
  ctx = await createTestApp();
  const login = await ctx.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: "child1", pin: "2468" },
  });
  token = login.json().accessToken as string;
  userId = ctx.db.select().from(users).where(eq(users.username, "child1")).get()?.id ?? "";
});

afterEach(async () => {
  await ctx.close();
});

function heatmap() {
  return ctx.app.inject({
    method: "GET",
    url: "/api/stats/heatmap",
    headers: { authorization: `Bearer ${token}` },
  });
}

function addMatrixRow(a: number, b: number, correct: boolean, timestamp: Date): void {
  ctx.db.insert(matrixStats).values({ userId, factorA: a, factorB: b, correct, timestamp }).run();
}

describe("T7 — stats read API", () => {
  it("case 1: 5 correct answers in the window make a green cell with accuracy 1", async () => {
    for (let i = 0; i < 5; i += 1) {
      addMatrixRow(2, 5, true, new Date());
    }
    const response = await heatmap();
    expect(response.statusCode).toBe(200);
    const cell = response
      .json()
      .cells.find((c: { a: number; b: number }) => c.a === 2 && c.b === 5);
    expect(cell).toMatchObject({ tries: 5, correct: 5, accuracy: 1, color: "green" });
  });

  it("case 2: 2/8 in the window is red", async () => {
    for (let i = 0; i < 6; i += 1) addMatrixRow(2, 5, false, new Date());
    for (let i = 0; i < 2; i += 1) addMatrixRow(2, 5, true, new Date());

    const response = await heatmap();
    const cell = response
      .json()
      .cells.find((c: { a: number; b: number }) => c.a === 2 && c.b === 5);
    expect(cell).toMatchObject({ tries: 8, correct: 2, accuracy: 0.25, color: "red" });
  });

  it("case 2b: accuracy 0.8 is green, 5/8 (0.625) is mixed", async () => {
    for (let i = 0; i < 4; i += 1) addMatrixRow(4, 4, true, new Date());
    for (let i = 0; i < 1; i += 1) addMatrixRow(4, 4, false, new Date());
    for (let i = 0; i < 5; i += 1) addMatrixRow(3, 3, true, new Date());
    for (let i = 0; i < 3; i += 1) addMatrixRow(3, 3, false, new Date());

    const response = await heatmap();
    const cells = response.json().cells;
    const green = cells.find((c: { a: number; b: number }) => c.a === 4 && c.b === 4);
    expect(green).toMatchObject({ tries: 5, correct: 4, accuracy: 0.8, color: "green" });
    const mixed = cells.find((c: { a: number; b: number }) => c.a === 3 && c.b === 3);
    expect(mixed).toMatchObject({ tries: 8, correct: 5, accuracy: 0.625, color: "mixed" });
  });

  it("case 3: rows older than 7 days are excluded", async () => {
    addMatrixRow(2, 5, false, new Date(Date.now() - 8 * 24 * 60 * 60 * 1000));
    const response = await heatmap();
    const cell = response
      .json()
      .cells.find((c: { a: number; b: number }) => c.a === 2 && c.b === 5);
    expect(cell).toMatchObject({ tries: 0, correct: 0, accuracy: null, color: "none" });
  });

  it("case 4: combinations without answers appear as 'none'", async () => {
    const response = await heatmap();
    const cells = response.json().cells;
    expect(cells.length).toBeGreaterThan(0);
    const cell = cells.find((c: { a: number; b: number }) => c.a === 4 && c.b === 4);
    expect(cell).toMatchObject({ tries: 0, correct: 0, accuracy: null, color: "none" });
  });

  it("case 5: the heatmap covers the union of two differently ranged games", async () => {
    const now = new Date();
    const extra = ctx.db
      .insert(games)
      .values({
        name: "Big Sevens",
        rangeAMin: 7,
        rangeAMax: 7,
        rangeBMin: 6,
        rangeBMax: 8,
        variantCount: 3,
        baseTimeReward: 10,
        timePenalty: 5,
        maxDailyTime: 3600,
        hintsJson: "[]",
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
    ctx.db.insert(userGameAssignments).values({ userId, gameId: extra.id }).run();

    const response = await heatmap();
    const cells = response.json().cells;
    expect(cells.find((c: { a: number; b: number }) => c.a === 2 && c.b === 1)).toBeTruthy();
    expect(cells.find((c: { a: number; b: number }) => c.a === 7 && c.b === 6)).toBeTruthy();
    expect(cells.find((c: { a: number; b: number }) => c.a === 15 && c.b === 15)).toBeUndefined();
  });

  it("case 6: GET /stats/daily mirrors the answers written today; a fresh user sees zeros", async () => {
    const gameId = ctx.db.select().from(games).where(eq(games.name, "Easy Twos")).get()?.id ?? "";
    await ctx.app.inject({
      method: "POST",
      url: "/api/answers",
      headers: { authorization: `Bearer ${token}` },
      payload: { gameId, factorA: 2, factorB: 3, chosen: 6, elapsedMs: 0 },
    });

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/stats/daily",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      totalTries: 1,
      correctTries: 1,
      timeEarnedSeconds: 10,
      timeBankSeconds: 10,
    });
    expect(response.json().date).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const freshLogin = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "admin", pin: "1289" },
    });
    const fresh = await ctx.app.inject({
      method: "GET",
      url: "/api/stats/daily",
      headers: { authorization: `Bearer ${freshLogin.json().accessToken as string}` },
    });
    expect(fresh.statusCode).toBe(200);
    expect(fresh.json()).toMatchObject({
      totalTries: 0,
      correctTries: 0,
      timeEarnedSeconds: 0,
      timeBankSeconds: 0,
    });
  });

  it("case 7: unauthenticated stats requests are rejected with 401", async () => {
    const heat = await ctx.app.inject({ method: "GET", url: "/api/stats/heatmap" });
    expect(heat.statusCode).toBe(401);
    const daily = await ctx.app.inject({ method: "GET", url: "/api/stats/daily" });
    expect(daily.statusCode).toBe(401);
  });
});

describe("T30 — child per-day per-game stats", () => {
  it("case: the signed-in child's matrix reflects posted answers; anonymous is 401", async () => {
    const easy = ctx.db.select().from(games).where(eq(games.name, "Easy Twos")).get();
    const mixed = ctx.db.select().from(games).where(eq(games.name, "Mixed Table")).get();

    const post = (gameId: string, factorA: number, factorB: number, chosen: number | null) =>
      ctx.app.inject({
        method: "POST",
        url: "/api/answers",
        headers: { authorization: `Bearer ${token}` },
        payload: { gameId, factorA, factorB, chosen, elapsedMs: 0 },
      });
    expect((await post(easy?.id as string, 3, 4, 12)).statusCode).toBe(200);
    expect((await post(mixed?.id as string, 5, 5, 25)).statusCode).toBe(200);

    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/stats/per-game",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.days).toHaveLength(7);
    const today = body.days[body.days.length - 1];
    expect(today.totals).toEqual({
      totalTries: 2,
      correctTries: 2,
      timeEarnedSeconds: 20,
      timeLostSeconds: 0,
    });
    expect(today.games).toContainEqual({
      gameId: easy?.id,
      totalTries: 1,
      correctTries: 1,
      timeEarnedSeconds: 10,
      timeLostSeconds: 0,
    });
    expect(today.games).toContainEqual({
      gameId: mixed?.id,
      totalTries: 1,
      correctTries: 1,
      timeEarnedSeconds: 10,
      timeLostSeconds: 0,
    });

    const anon = await ctx.app.inject({ method: "GET", url: "/api/stats/per-game" });
    expect(anon.statusCode).toBe(401);
  });
});

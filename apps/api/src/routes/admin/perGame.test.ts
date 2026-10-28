import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { dailyStats, gameDailyStats, games, users } from "../../db/schema.js";
import { type TestApp, createTestApp } from "../../test/helper.js";

let ctx: TestApp;
let adminToken: string;
let childToken: string;
let childId: string;
let easyId: string;
let mixedId: string;

function dateAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

beforeEach(async () => {
  ctx = await createTestApp();
  const adminLogin = await ctx.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: "admin", pin: "1289" },
  });
  adminToken = adminLogin.json().accessToken as string;
  const childLogin = await ctx.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: "child1", pin: "2468" },
  });
  childToken = childLogin.json().accessToken as string;
  childId = ctx.db.select().from(users).where(eq(users.username, "child1")).get()?.id ?? "";
  easyId = ctx.db.select().from(games).where(eq(games.name, "Easy Twos")).get()?.id ?? "";
  mixedId = ctx.db.select().from(games).where(eq(games.name, "Mixed Table")).get()?.id ?? "";
});

afterEach(async () => {
  await ctx.close();
});

function answer(
  token: string,
  gameId: string,
  factorA: number,
  factorB: number,
  chosen: number | null,
) {
  return ctx.app.inject({
    method: "POST",
    url: "/api/answers",
    headers: { authorization: `Bearer ${token}` },
    payload: { gameId, factorA, factorB, chosen, elapsedMs: 0 },
  });
}

function perGame(token: string | null, id: string, query = "") {
  return ctx.app.inject({
    method: "GET",
    url: `/api/admin/users/${id}/per-game${query}`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe("T28 — per-day per-game stats", () => {
  it("case 1: today's per-game sums match the posted answers", async () => {
    expect((await answer(childToken, easyId, 3, 4, 12)).statusCode).toBe(200);
    expect((await answer(childToken, easyId, 3, 4, 13)).statusCode).toBe(200);
    expect((await answer(childToken, mixedId, 5, 5, 25)).statusCode).toBe(200);

    const response = await perGame(adminToken, childId);
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.user).toMatchObject({ id: childId, username: "child1" });
    expect(body.days).toHaveLength(7);
    const today = body.days[body.days.length - 1];
    expect(today.totals).toEqual({
      totalTries: 3,
      correctTries: 2,
      timeEarnedSeconds: 20,
      timeLostSeconds: 5,
    });
    expect(today.games).toContainEqual({
      gameId: easyId,
      totalTries: 2,
      correctTries: 1,
      timeEarnedSeconds: 10,
      timeLostSeconds: 5,
    });
    expect(today.games).toContainEqual({
      gameId: mixedId,
      totalTries: 1,
      correctTries: 1,
      timeEarnedSeconds: 10,
      timeLostSeconds: 0,
    });
  });

  it("case 2: past days appear with their games, idle days are empty", async () => {
    ctx.db
      .insert(gameDailyStats)
      .values({
        userId: childId,
        gameId: easyId,
        date: dateAgo(3),
        totalTries: 4,
        correctTries: 3,
        timeEarnedSeconds: 30,
      })
      .run();
    ctx.db
      .insert(gameDailyStats)
      .values({
        userId: childId,
        gameId: mixedId,
        date: dateAgo(1),
        totalTries: 2,
        correctTries: 2,
        timeEarnedSeconds: 20,
      })
      .run();
    // Totals come from daily_stats — including a legacy day with no per-game rows.
    ctx.db
      .insert(dailyStats)
      .values({
        userId: childId,
        date: dateAgo(3),
        totalTries: 4,
        correctTries: 3,
        timeEarnedSeconds: 30,
      })
      .run();
    ctx.db
      .insert(dailyStats)
      .values({
        userId: childId,
        date: dateAgo(4),
        totalTries: 5,
        correctTries: 4,
        timeEarnedSeconds: 40,
      })
      .run();

    const body = (await perGame(adminToken, childId)).json();
    const byDate = new Map(
      body.days.map(
        (day: { date: string; totals: unknown; games: unknown[] }) => [day.date, day] as const,
      ),
    );
    const three = byDate.get(dateAgo(3)) as { totals: unknown; games: unknown[] };
    expect(three.totals).toEqual({
      totalTries: 4,
      correctTries: 3,
      timeEarnedSeconds: 30,
      timeLostSeconds: 0,
    });
    expect(three.games).toContainEqual({
      gameId: easyId,
      totalTries: 4,
      correctTries: 3,
      timeEarnedSeconds: 30,
      timeLostSeconds: 0,
    });
    const one = byDate.get(dateAgo(1)) as { totals: unknown; games: unknown[] };
    expect(one.totals).toEqual({
      totalTries: 0,
      correctTries: 0,
      timeEarnedSeconds: 0,
      timeLostSeconds: 0,
    });
    expect(one.games).toContainEqual({
      gameId: mixedId,
      totalTries: 2,
      correctTries: 2,
      timeEarnedSeconds: 20,
      timeLostSeconds: 0,
    });
    // Legacy day: totals show, game cells stay empty.
    const four = byDate.get(dateAgo(4)) as { totals: unknown; games: unknown[] };
    expect(four.totals).toEqual({
      totalTries: 5,
      correctTries: 4,
      timeEarnedSeconds: 40,
      timeLostSeconds: 0,
    });
    expect(four.games).toEqual([]);
    const idle = byDate.get(dateAgo(2)) as { totals: unknown; games: unknown[] };
    expect(idle.totals).toEqual({
      totalTries: 0,
      correctTries: 0,
      timeEarnedSeconds: 0,
      timeLostSeconds: 0,
    });
    expect(idle.games).toEqual([]);
  });

  it("case 3: a fresh user gets seven empty days", async () => {
    const created = await ctx.app.inject({
      method: "POST",
      url: "/api/admin/users",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { username: "child2", pin: "1111" },
    });
    expect(created.statusCode).toBe(201);
    const body = (await perGame(adminToken, created.json().id as string)).json();
    expect(body.days).toHaveLength(7);
    for (const day of body.days) expect(day.games).toEqual([]);
  });

  it("case 4: child token is forbidden, anonymous is unauthorized, unknown id is 404", async () => {
    expect((await perGame(childToken, childId)).statusCode).toBe(403);
    expect((await perGame(null, childId)).statusCode).toBe(401);
    const missing = await perGame(adminToken, "no-such-user");
    expect(missing.statusCode).toBe(404);
    expect(missing.json()).toEqual({ error: { code: "NOT_FOUND", message: expect.any(String) } });
  });

  it("case 5: a just-recorded answer is visible immediately", async () => {
    const before = (await perGame(adminToken, childId)).json();
    const todayBefore = before.days[before.days.length - 1].games;
    expect(todayBefore).toEqual([]);

    await answer(childToken, easyId, 2, 2, 4);
    const after = (await perGame(adminToken, childId)).json();
    expect(after.days[after.days.length - 1].games).toContainEqual({
      gameId: easyId,
      totalTries: 1,
      correctTries: 1,
      timeEarnedSeconds: 10,
      timeLostSeconds: 0,
    });
  });
});

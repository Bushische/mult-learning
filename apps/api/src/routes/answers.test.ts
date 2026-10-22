import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { dailyStats, games, matrixStats, users } from "../db/schema.js";
import { todayUtc } from "../services/answerService.js";
import { type TestApp, createTestApp } from "../test/helper.js";

let ctx: TestApp;
let token: string;
let easyTwosId: string;

beforeEach(async () => {
  ctx = await createTestApp();
  const login = await ctx.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username: "child1", pin: "2468" },
  });
  token = login.json().accessToken as string;
  easyTwosId = ctx.db.select().from(games).where(eq(games.name, "Easy Twos")).get()?.id ?? "";
});

afterEach(async () => {
  await ctx.close();
});

function answer(payload: Record<string, unknown>) {
  return ctx.app.inject({
    method: "POST",
    url: "/api/answers",
    headers: { authorization: `Bearer ${token}` },
    payload,
  });
}

describe("T6 — answer submission", () => {
  it("case 1: a correct answer rewards the bank and writes matrix + daily stats", async () => {
    const response = await answer({
      gameId: easyTwosId,
      factorA: 2,
      factorB: 3,
      chosen: 6,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      correct: true,
      rightAnswer: 6,
      timeBankSeconds: 10,
      timeDelta: 10,
    });

    const matrix = ctx.db.select().from(matrixStats).all();
    expect(matrix).toHaveLength(1);
    expect(matrix[0]).toMatchObject({ factorA: 2, factorB: 3, correct: true });

    const daily = ctx.db
      .select()
      .from(dailyStats)
      .where(and(eq(dailyStats.date, todayUtc()), eq(dailyStats.userId, matrix[0]?.userId ?? "")))
      .get();
    expect(daily).toMatchObject({ totalTries: 1, correctTries: 1, timeEarnedSeconds: 10 });

    const user = ctx.db.select().from(users).where(eq(users.username, "child1")).get();
    expect(user?.timeBankSeconds).toBe(10);
  });

  it("case 2: wrong answers subtract the penalty and never go below 0", async () => {
    await answer({ gameId: easyTwosId, factorA: 2, factorB: 3, chosen: 6 });
    const wrong = await answer({ gameId: easyTwosId, factorA: 2, factorB: 4, chosen: 7 });
    expect(wrong.json()).toMatchObject({ correct: false, rightAnswer: 8, timeBankSeconds: 5 });

    const first = await answer({ gameId: easyTwosId, factorA: 3, factorB: 3, chosen: 8 });
    expect(first.json().timeBankSeconds).toBe(0);
    const second = await answer({ gameId: easyTwosId, factorA: 3, factorB: 3, chosen: 8 });
    expect(second.json().timeBankSeconds).toBe(0);
    expect(second.json().timeDelta).toBe(0);
  });

  it("case 3: a timeout (chosen null) counts as wrong", async () => {
    await answer({ gameId: easyTwosId, factorA: 2, factorB: 3, chosen: 6 });
    const timeout = await answer({
      gameId: easyTwosId,
      factorA: 2,
      factorB: 4,
      chosen: null,
    });
    expect(timeout.json()).toMatchObject({ correct: false, rightAnswer: 8, timeBankSeconds: 5 });

    const matrix = ctx.db.select().from(matrixStats).all();
    expect(matrix).toHaveLength(2);
    expect(matrix[1]?.correct).toBe(false);
  });

  it("case 4: at the cap the bank does not grow but the stats still count", async () => {
    const user = ctx.db.select().from(users).where(eq(users.username, "child1")).get();
    ctx.db
      .update(users)
      .set({ timeBankSeconds: 3600 })
      .where(eq(users.id, user?.id ?? ""))
      .run();

    const response = await answer({
      gameId: easyTwosId,
      factorA: 2,
      factorB: 3,
      chosen: 6,
    });
    expect(response.json()).toMatchObject({
      correct: true,
      timeBankSeconds: 3600,
      timeDelta: 0,
    });

    const daily = ctx.db.select().from(dailyStats).all();
    expect(daily).toHaveLength(1);
    expect(daily[0]).toMatchObject({ totalTries: 1, correctTries: 1, timeEarnedSeconds: 0 });
  });

  it("case 5: an unassigned game is 403 and an unknown game is 404", async () => {
    const admin = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "admin", pin: "1289" },
    });
    const adminToken = admin.json().accessToken as string;

    const created = await ctx.app.inject({
      method: "POST",
      url: "/api/answers",
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { gameId: easyTwosId, factorA: 2, factorB: 3, chosen: 6 },
    });
    expect(created.statusCode).toBe(403);
    expect(created.json().error.code).toBe("FORBIDDEN");

    const unknown = await answer({
      gameId: "does-not-exist",
      factorA: 2,
      factorB: 3,
      chosen: 6,
    });
    expect(unknown.statusCode).toBe(404);
    expect(unknown.json().error.code).toBe("NOT_FOUND");
  });

  it("case 6: an unauthenticated answer is rejected with 401", async () => {
    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/answers",
      payload: { gameId: easyTwosId, factorA: 2, factorB: 3, chosen: 6 },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("UNAUTHORIZED");
  });
});

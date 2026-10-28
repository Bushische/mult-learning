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
      elapsedMs: 0,
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
    await answer({ gameId: easyTwosId, factorA: 2, factorB: 3, chosen: 6, elapsedMs: 0 });
    const wrong = await answer({
      gameId: easyTwosId,
      factorA: 2,
      factorB: 4,
      chosen: 7,
      elapsedMs: 0,
    });
    expect(wrong.json()).toMatchObject({ correct: false, rightAnswer: 8, timeBankSeconds: 5 });

    const first = await answer({
      gameId: easyTwosId,
      factorA: 3,
      factorB: 3,
      chosen: 8,
      elapsedMs: 0,
    });
    expect(first.json().timeBankSeconds).toBe(0);
    const second = await answer({
      gameId: easyTwosId,
      factorA: 3,
      factorB: 3,
      chosen: 8,
      elapsedMs: 0,
    });
    expect(second.json().timeBankSeconds).toBe(0);
    expect(second.json().timeDelta).toBe(0);
  });

  it("case 3: a timeout (chosen null) counts as wrong", async () => {
    await answer({ gameId: easyTwosId, factorA: 2, factorB: 3, chosen: 6, elapsedMs: 0 });
    const timeout = await answer({
      gameId: easyTwosId,
      factorA: 2,
      factorB: 4,
      chosen: null,
      elapsedMs: 0,
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
      .set({ timeBankSeconds: 3600, bankDate: todayUtc() })
      .where(eq(users.id, user?.id ?? ""))
      .run();

    const response = await answer({
      gameId: easyTwosId,
      factorA: 2,
      factorB: 3,
      chosen: 6,
      elapsedMs: 0,
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
      payload: { gameId: easyTwosId, factorA: 2, factorB: 3, chosen: 6, elapsedMs: 0 },
    });
    expect(created.statusCode).toBe(403);
    expect(created.json().error.code).toBe("FORBIDDEN");

    const unknown = await answer({
      gameId: "does-not-exist",
      factorA: 2,
      factorB: 3,
      chosen: 6,
      elapsedMs: 0,
    });
    expect(unknown.statusCode).toBe(404);
    expect(unknown.json().error.code).toBe("NOT_FOUND");
  });

  it("case 6: an unauthenticated answer is rejected with 401", async () => {
    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/answers",
      payload: { gameId: easyTwosId, factorA: 2, factorB: 3, chosen: 6, elapsedMs: 0 },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("UNAUTHORIZED");
  });
});

describe("T23 — time-decayed reward", () => {
  it("case 1: elapsed 0 ms and 2000 ms pay the full reward (grace period)", async () => {
    for (const elapsedMs of [0, 2000]) {
      const response = await answer({
        gameId: easyTwosId,
        factorA: 2,
        factorB: 3,
        chosen: 6,
        elapsedMs,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ correct: true, timeDelta: 10 });
    }
  });

  it("case 2: elapsed 9000 ms of 15000 ms pays round(10 * 6000 / 12000) = 5", async () => {
    const response = await answer({
      gameId: easyTwosId,
      factorA: 2,
      factorB: 3,
      chosen: 6,
      elapsedMs: 9000,
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ correct: true, timeDelta: 5, timeBankSeconds: 5 });
  });

  it("case 3: elapsed at/past the countdown pays +0 and the bank is unchanged", async () => {
    for (const elapsedMs of [15000, 99999]) {
      const response = await answer({
        gameId: easyTwosId,
        factorA: 2,
        factorB: 3,
        chosen: 6,
        elapsedMs,
      });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ correct: true, timeDelta: 0, timeBankSeconds: 0 });
    }
  });

  it("case 4: a wrong answer (or timeout) still subtracts the penalty", async () => {
    await answer({ gameId: easyTwosId, factorA: 2, factorB: 3, chosen: 6, elapsedMs: 0 });
    const wrong = await answer({
      gameId: easyTwosId,
      factorA: 2,
      factorB: 3,
      chosen: 5,
      elapsedMs: 0,
    });
    expect(wrong.json()).toMatchObject({ correct: false, timeDelta: -5, timeBankSeconds: 5 });

    const timeout = await answer({
      gameId: easyTwosId,
      factorA: 2,
      factorB: 3,
      chosen: null,
      elapsedMs: 15000,
    });
    expect(timeout.json()).toMatchObject({ correct: false, timeDelta: -5, timeBankSeconds: 0 });
  });

  it("case 5: missing/negative/non-integer elapsedMs is a 400", async () => {
    const base = { gameId: easyTwosId, factorA: 2, factorB: 3, chosen: 6 };
    for (const elapsedMs of [undefined, -1, 1.5, "9000"]) {
      const payload = elapsedMs === undefined ? base : { ...base, elapsedMs };
      const response = await answer(payload);
      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe("VALIDATION_ERROR");
    }
  });
});

describe("T39 — per-day time bank", () => {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  function setBank(seconds: number, date: string | null): string {
    const id = ctx.db.select().from(users).where(eq(users.username, "child1")).get()?.id ?? "";
    ctx.db
      .update(users)
      .set({ timeBankSeconds: seconds, bankDate: date })
      .where(eq(users.id, id))
      .run();
    return id;
  }

  function correctAnswer() {
    return answer({ gameId: easyTwosId, factorA: 2, factorB: 3, chosen: 6, elapsedMs: 0 });
  }

  it("case 1: yesterday's bank expires on the first answer today", async () => {
    const id = setBank(100, yesterday);
    ctx.db
      .insert(dailyStats)
      .values({
        userId: id,
        date: yesterday,
        totalTries: 5,
        correctTries: 4,
        timeEarnedSeconds: 40,
      })
      .run();

    const response = await correctAnswer();
    expect(response.json()).toMatchObject({ correct: true, timeBankSeconds: 10, timeDelta: 10 });

    const dates = ctx.db
      .select()
      .from(dailyStats)
      .where(eq(dailyStats.userId, id))
      .all()
      .map((row) => row.date)
      .sort();
    expect(dates).toEqual([yesterday, todayUtc()].sort());
  });

  it("case 2: the cap restarts every day", async () => {
    setBank(3600, yesterday);
    const response = await correctAnswer();
    expect(response.json()).toMatchObject({ correct: true, timeBankSeconds: 10, timeDelta: 10 });
  });

  it("case 3: intraday clamping is unchanged", async () => {
    setBank(3595, todayUtc());
    const first = await correctAnswer();
    expect(first.json()).toMatchObject({ timeBankSeconds: 3600, timeDelta: 5 });
    const second = await correctAnswer();
    expect(second.json()).toMatchObject({ timeBankSeconds: 3600, timeDelta: 0 });
  });

  it("case 4: reset clears the day marker", async () => {
    const childId = setBank(100, todayUtc());
    const adminLogin = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "admin", pin: "1289" },
    });
    const reset = await ctx.app.inject({
      method: "POST",
      url: `/api/admin/users/${childId}/reset`,
      headers: { authorization: `Bearer ${adminLogin.json().accessToken as string}` },
    });
    expect(reset.statusCode).toBe(204);

    const response = await correctAnswer();
    expect(response.json()).toMatchObject({ correct: true, timeBankSeconds: 10, timeDelta: 10 });
  });

  it("case 5: anonymous answers are still 401", async () => {
    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/answers",
      payload: { gameId: easyTwosId, factorA: 2, factorB: 3, chosen: 6, elapsedMs: 0 },
    });
    expect(response.statusCode).toBe(401);
  });
});

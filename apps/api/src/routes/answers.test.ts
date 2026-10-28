import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { dailyStats, gameDailyStats, games, matrixStats, users } from "../db/schema.js";
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

  it("case 3: elapsed at/past the countdown pays the penalty floor", async () => {
    let bank = 0;
    for (const elapsedMs of [15000, 99999]) {
      const response = await answer({
        gameId: easyTwosId,
        factorA: 2,
        factorB: 3,
        chosen: 6,
        elapsedMs,
      });
      bank += 5;
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ correct: true, timeDelta: 5, timeBankSeconds: bank });
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

describe("T41 — correct answers never pay +0:00", () => {
  function userId(): string {
    return ctx.db.select().from(users).where(eq(users.username, "child1")).get()?.id ?? "";
  }

  it("case 3: at a full bank a slow correct answer credits +0 but counts the try", async () => {
    const id = userId();
    ctx.db
      .update(users)
      .set({ timeBankSeconds: 3600, bankDate: todayUtc() })
      .where(eq(users.id, id))
      .run();

    const response = await ctx.app.inject({
      method: "POST",
      url: "/api/answers",
      headers: { authorization: `Bearer ${token}` },
      payload: { gameId: easyTwosId, factorA: 2, factorB: 3, chosen: 6, elapsedMs: 14900 },
    });
    expect(response.json()).toMatchObject({ correct: true, timeDelta: 0, timeBankSeconds: 3600 });

    const daily = ctx.db
      .select()
      .from(dailyStats)
      .where(and(eq(dailyStats.userId, id), eq(dailyStats.date, todayUtc())))
      .get();
    expect(daily).toMatchObject({ totalTries: 1, correctTries: 1, timeEarnedSeconds: 0 });
  });
});

describe("T40 — recorded gain and loss", () => {
  function userId(): string {
    return ctx.db.select().from(users).where(eq(users.username, "child1")).get()?.id ?? "";
  }

  it("case 4: only actually taken seconds count as lost", async () => {
    const id = userId();
    // correct (+10), then wrong with a funded bank (−5 taken)
    await answer({ gameId: easyTwosId, factorA: 2, factorB: 3, chosen: 6, elapsedMs: 0 });
    await answer({ gameId: easyTwosId, factorA: 2, factorB: 3, chosen: 5, elapsedMs: 0 });

    const daily = ctx.db
      .select()
      .from(dailyStats)
      .where(and(eq(dailyStats.userId, id), eq(dailyStats.date, todayUtc())))
      .get();
    expect(daily).toMatchObject({
      totalTries: 2,
      correctTries: 1,
      timeEarnedSeconds: 10,
      timeLostSeconds: 5,
    });

    const perGame = ctx.db.select().from(gameDailyStats).where(eq(gameDailyStats.userId, id)).all();
    expect(perGame).toHaveLength(1);
    expect(perGame[0]).toMatchObject({
      totalTries: 2,
      correctTries: 1,
      timeEarnedSeconds: 10,
      timeLostSeconds: 5,
    });

    // wrong at an empty bank takes nothing: lost stays, bank stays 0
    ctx.db
      .update(users)
      .set({ timeBankSeconds: 0, bankDate: todayUtc() })
      .where(eq(users.id, id))
      .run();
    const timeout = await answer({
      gameId: easyTwosId,
      factorA: 2,
      factorB: 3,
      chosen: null,
      elapsedMs: 15000,
    });
    expect(timeout.json()).toMatchObject({ correct: false, timeDelta: 0, timeBankSeconds: 0 });
    const after = ctx.db
      .select()
      .from(dailyStats)
      .where(and(eq(dailyStats.userId, id), eq(dailyStats.date, todayUtc())))
      .get();
    expect(after).toMatchObject({
      totalTries: 3,
      correctTries: 1,
      timeEarnedSeconds: 10,
      timeLostSeconds: 5,
    });
  });

  it("case 5: reset wipes the gain/loss counters", async () => {
    const id = userId();
    await answer({ gameId: easyTwosId, factorA: 2, factorB: 3, chosen: 6, elapsedMs: 0 });

    const adminLogin = await ctx.app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { username: "admin", pin: "1289" },
    });
    const reset = await ctx.app.inject({
      method: "POST",
      url: `/api/admin/users/${id}/reset`,
      headers: { authorization: `Bearer ${adminLogin.json().accessToken as string}` },
    });
    expect(reset.statusCode).toBe(204);
    expect(ctx.db.select().from(dailyStats).where(eq(dailyStats.userId, id)).all()).toHaveLength(0);
    expect(
      ctx.db.select().from(gameDailyStats).where(eq(gameDailyStats.userId, id)).all(),
    ).toHaveLength(0);

    const response = await answer({
      gameId: easyTwosId,
      factorA: 2,
      factorB: 3,
      chosen: 6,
      elapsedMs: 0,
    });
    expect(response.json()).toMatchObject({ correct: true, timeDelta: 10, timeBankSeconds: 10 });
    const daily = ctx.db
      .select()
      .from(dailyStats)
      .where(and(eq(dailyStats.userId, id), eq(dailyStats.date, todayUtc())))
      .get();
    expect(daily).toMatchObject({
      totalTries: 1,
      correctTries: 1,
      timeEarnedSeconds: 10,
      timeLostSeconds: 0,
    });
  });
});

describe("T44 — answer checking per operation", () => {
  async function mixedGameId(): Promise<string> {
    const now = new Date();
    const inserted = ctx.db
      .insert(games)
      .values({
        name: "Mixed Ops",
        operationsJson: JSON.stringify(["add", "sub", "mul", "div"]),
        rangeAMin: 1,
        rangeAMax: 10,
        rangeBMin: 1,
        rangeBMax: 10,
        allowedCombinationsJson: null,
        variantCount: 3,
        baseTimeReward: 10,
        timePenalty: 5,
        maxDailyTime: 3600,
        questionSeconds: 15,
        hintsJson: "[]",
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
    const child = ctx.db.select().from(users).where(eq(users.username, "child1")).get();
    const { userGameAssignments } = await import("../db/schema.js");
    ctx.db
      .insert(userGameAssignments)
      .values({ userId: child?.id ?? "", gameId: inserted.id })
      .run();
    return inserted.id;
  }

  it("case 1: correct answers for + − × ÷ are all accepted", async () => {
    const gameId = await mixedGameId();
    for (const [operation, factorA, factorB, chosen] of [
      ["add", 7, 5, 12],
      ["sub", 9, 4, 5],
      ["mul", 3, 4, 12],
      ["div", 8, 2, 4],
    ] as const) {
      const response = await answer({ gameId, operation, factorA, factorB, chosen, elapsedMs: 0 });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ correct: true });
    }
  });

  it("case 2: a wrong + answer applies the penalty", async () => {
    const gameId = await mixedGameId();
    await answer({ gameId, operation: "mul", factorA: 3, factorB: 4, chosen: 12, elapsedMs: 0 });
    const response = await answer({
      gameId,
      operation: "add",
      factorA: 7,
      factorB: 5,
      chosen: 13,
      elapsedMs: 0,
    });
    expect(response.json()).toMatchObject({ correct: false, rightAnswer: 12, timeDelta: -5 });
  });

  it("case 3: timeout on a ÷ question counts as wrong and writes one matrix row", async () => {
    const gameId = await mixedGameId();
    const before = ctx.db.select().from(matrixStats).all().length;
    const response = await answer({
      gameId,
      operation: "div",
      factorA: 8,
      factorB: 2,
      chosen: null,
      elapsedMs: 15000,
    });
    expect(response.json()).toMatchObject({ correct: false, rightAnswer: 4 });
    expect(ctx.db.select().from(matrixStats).all()).toHaveLength(before + 1);
  });
});

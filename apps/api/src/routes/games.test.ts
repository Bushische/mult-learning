import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { games, userGameAssignments, users } from "../db/schema.js";
import { type TestApp, createTestApp } from "../test/helper.js";

let ctx: TestApp;

beforeEach(async () => {
  ctx = await createTestApp();
});

afterEach(async () => {
  await ctx.close();
});

async function tokenFor(username: string, pin: string): Promise<string> {
  const response = await ctx.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { username, pin },
  });
  return response.json().accessToken as string;
}

describe("T5 — games read API", () => {
  it("case 1: a child sees exactly the games assigned to them", async () => {
    const now = new Date();
    const game = ctx.db
      .insert(games)
      .values({
        name: "Only Mine",
        rangeAMin: 2,
        rangeAMax: 4,
        rangeBMin: 5,
        rangeBMax: 8,
        allowedCombinationsJson: null,
        variantCount: 5,
        baseTimeReward: 12,
        timePenalty: 4,
        maxDailyTime: 1800,
        hintsJson: JSON.stringify([{ factor: 10, text: "Just add a 0 at the end!" }]),
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    const child = ctx.db
      .insert(users)
      .values({
        username: "solo",
        pinHash: bcrypt.hashSync("2468", 10),
        role: "user",
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
    ctx.db.insert(userGameAssignments).values({ userId: child.id, gameId: game.id }).run();

    const token = await tokenFor("solo", "2468");
    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/games",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toEqual({
      id: game.id,
      name: "Only Mine",
      rangeA: { min: 2, max: 4 },
      rangeB: { min: 5, max: 8 },
      allowedCombinations: null,
      variantCount: 5,
      baseTimeReward: 12,
      timePenalty: 4,
      maxDailyTime: 1800,
      questionSeconds: 15,
      hints: [{ factor: 10, text: "Just add a 0 at the end!" }],
    });
  });

  it("case 2: an admin sees every game, assigned or not", async () => {
    const token = await tokenFor("admin", "1289");
    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/games",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(200);
    const names = response.json().map((game: { name: string }) => game.name);
    expect(names).toEqual(expect.arrayContaining(["Easy Twos", "Mixed Table"]));
  });

  it("case 3: an unauthenticated request is rejected with 401", async () => {
    const response = await ctx.app.inject({ method: "GET", url: "/api/games" });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe("UNAUTHORIZED");
  });

  it("case 4: NULL allowed_combinations_json serializes as null", async () => {
    const token = await tokenFor("child1", "2468");
    const response = await ctx.app.inject({
      method: "GET",
      url: "/api/games",
      headers: { authorization: `Bearer ${token}` },
    });
    const body = response.json() as { allowedCombinations: unknown }[];
    expect(body.length).toBeGreaterThan(0);
    for (const game of body) {
      expect(game.allowedCombinations).toBeNull();
    }
    const row = ctx.db.select().from(games).where(eq(games.name, "Easy Twos")).get();
    expect(row?.allowedCombinationsJson).toBeNull();
  });
});

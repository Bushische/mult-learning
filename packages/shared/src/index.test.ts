import { describe, expect, it } from "vitest";
import {
  type GameConfig,
  REWARD_GRACE_MS,
  answerRequestSchema,
  computeRewardSeconds,
  gameConfigSchema,
  heatmapCellSchema,
} from "./index";

const validGameConfig: GameConfig = {
  name: "Easy Twos",
  rangeA: { min: 2, max: 4 },
  rangeB: { min: 5, max: 8 },
  allowedCombinations: null,
  variantCount: 3,
  baseTimeReward: 10,
  timePenalty: 5,
  maxDailyTime: 3600,
  questionSeconds: 15,
  hints: [{ factor: 10, text: "Just add a 0 at the end!" }],
};

describe("T1 — shared contracts", () => {
  it("case 1: a valid game config parses and survives stringify/parse", () => {
    const parsed = gameConfigSchema.parse(validGameConfig);
    expect(parsed).toEqual(validGameConfig);
    const roundTripped = gameConfigSchema.parse(JSON.parse(JSON.stringify(parsed)));
    expect(roundTripped).toEqual(validGameConfig);
  });

  it("case 2: rejects variantCount 2 and 7, factor 21 and min > max ranges", () => {
    expect(() => gameConfigSchema.parse({ ...validGameConfig, variantCount: 2 })).toThrow();
    expect(() => gameConfigSchema.parse({ ...validGameConfig, variantCount: 7 })).toThrow();
    expect(() =>
      gameConfigSchema.parse({ ...validGameConfig, rangeA: { min: 1, max: 21 } }),
    ).toThrow();
    expect(() =>
      gameConfigSchema.parse({ ...validGameConfig, rangeB: { min: 9, max: 3 } }),
    ).toThrow();
  });

  it("case 3: answer request rejects non-integer chosen and missing gameId, accepts null chosen", () => {
    const base = { gameId: "abc123", factorA: 2, factorB: 3, elapsedMs: 0 };
    expect(answerRequestSchema.parse({ ...base, chosen: 6 })).toEqual({ ...base, chosen: 6 });
    expect(answerRequestSchema.parse({ ...base, chosen: null })).toEqual({ ...base, chosen: null });
    expect(() => answerRequestSchema.parse({ ...base, chosen: 6.5 })).toThrow();
    expect(() => answerRequestSchema.parse({ factorA: 2, factorB: 3, chosen: 6 })).toThrow();
  });

  it("case 4: heatmap cell rejects unknown color and accepts null accuracy with 0 tries", () => {
    const cell = { a: 2, b: 5, tries: 0, correct: 0, accuracy: null, color: "none" };
    expect(heatmapCellSchema.parse(cell)).toEqual(cell);
    expect(() => heatmapCellSchema.parse({ ...cell, color: "blue" })).toThrow();
    expect(
      heatmapCellSchema.parse({ a: 2, b: 5, tries: 6, correct: 5, accuracy: 0.83, color: "mixed" }),
    ).toBeTruthy();
  });
});

describe("T23 — time-decayed reward helper", () => {
  const base = { baseTimeReward: 10, questionSeconds: 15 };
  it("case 1: full reward at 0 ms and inside the grace period", () => {
    expect(computeRewardSeconds({ ...base, elapsedMs: 0 })).toBe(10);
    expect(computeRewardSeconds({ ...base, elapsedMs: 2000 })).toBe(10);
    expect(computeRewardSeconds({ ...base, elapsedMs: REWARD_GRACE_MS })).toBe(10);
  });

  it("case 2: elapsed 9000 ms of 15000 ms pays 5", () => {
    expect(computeRewardSeconds({ ...base, elapsedMs: 9000 })).toBe(5);
  });

  it("case 3: elapsed at/past the countdown clamps to 0, never negative", () => {
    expect(computeRewardSeconds({ ...base, elapsedMs: 15000 })).toBe(0);
    expect(computeRewardSeconds({ ...base, elapsedMs: 99999 })).toBe(0);
    expect(computeRewardSeconds({ ...base, elapsedMs: -50 })).toBe(10);
  });

  it("case 5: questionSeconds 4 and 61 are rejected, 5..60 accepted, default 15", () => {
    expect(() => gameConfigSchema.parse({ ...validGameConfig, questionSeconds: 4 })).toThrow();
    expect(() => gameConfigSchema.parse({ ...validGameConfig, questionSeconds: 61 })).toThrow();
    expect(gameConfigSchema.parse({ ...validGameConfig, questionSeconds: 5 }).questionSeconds).toBe(
      5,
    );
    expect(
      gameConfigSchema.parse({ ...validGameConfig, questionSeconds: 60 }).questionSeconds,
    ).toBe(60);
    const without = { ...validGameConfig, questionSeconds: undefined };
    expect(gameConfigSchema.parse(without).questionSeconds).toBe(15);
  });
});

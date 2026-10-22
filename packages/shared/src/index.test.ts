import { describe, expect, it } from "vitest";
import { type GameConfig, answerRequestSchema, gameConfigSchema, heatmapCellSchema } from "./index";

const validGameConfig: GameConfig = {
  name: "Easy Twos",
  rangeA: { min: 2, max: 4 },
  rangeB: { min: 5, max: 8 },
  allowedCombinations: null,
  variantCount: 3,
  baseTimeReward: 10,
  timePenalty: 5,
  maxDailyTime: 3600,
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
    const base = { gameId: "abc123", factorA: 2, factorB: 3 };
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

import type { Game } from "@mult/shared";
import { describe, expect, it } from "vitest";
import { buildOptions, generateQuestion } from "./question";
import { createSeededRng } from "./random";

const GAME: Game = {
  id: "g-easy",
  name: "Easy Twos",
  operations: ["mul"],
  rangeA: { min: 2, max: 4 },
  rangeB: { min: 1, max: 4 },
  allowedCombinations: null,
  variantCount: 3,
  baseTimeReward: 10,
  timePenalty: 5,
  maxDailyTime: 3600,
  questionSeconds: 15,
  hints: [],
};

const TABLE_NEIGHBOURS = new Set([9, 15, 8, 16]);

describe("T26 — misleading distractor options", () => {
  it("case 1: 3 × 4 with N=3 holds 12 once plus a nearby table product", () => {
    const options = buildOptions(3, 4, 3, createSeededRng(42));
    expect(options).toHaveLength(3);
    expect(options.filter((value) => value === 12)).toHaveLength(1);
    expect(options.some((value) => TABLE_NEIGHBOURS.has(value))).toBe(true);
  });

  it("case 1b: every table neighbour is reachable across seeds", () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 50; seed += 1) {
      for (const value of buildOptions(3, 4, 3, createSeededRng(seed))) {
        seen.add(value);
      }
    }
    for (const neighbour of TABLE_NEIGHBOURS) {
      expect(seen.has(neighbour)).toBe(true);
    }
  });

  it("case 2: no duplicates and exactly variantCount options for N = 3..6", () => {
    for (let variantCount = 3; variantCount <= 6; variantCount += 1) {
      for (let seed = 0; seed < 25; seed += 1) {
        const options = buildOptions(3, 4, variantCount, createSeededRng(seed));
        expect(options).toHaveLength(variantCount);
        expect(new Set(options).size).toBe(variantCount);
        expect(options.filter((value) => value === 12)).toHaveLength(1);
      }
    }
  });

  it("case 3: the set is never solely right ±1/±2 when neighbours exist", () => {
    for (let variantCount = 3; variantCount <= 6; variantCount += 1) {
      for (let seed = 0; seed < 50; seed += 1) {
        const options = buildOptions(3, 4, variantCount, createSeededRng(seed));
        const far = options.filter((value) => value !== 12 && Math.abs(value - 12) >= 3);
        expect(far.length).toBeGreaterThan(0);
      }
    }
  });

  it("case 4: tiny tables stay positive integers with exact counts", () => {
    for (const [a, b] of [
      [1, 1],
      [1, 2],
    ] as const) {
      for (let variantCount = 3; variantCount <= 6; variantCount += 1) {
        for (let seed = 0; seed < 25; seed += 1) {
          const options = buildOptions(a, b, variantCount, createSeededRng(seed));
          expect(options).toHaveLength(variantCount);
          expect(new Set(options).size).toBe(variantCount);
          expect(options.filter((value) => value === a * b)).toHaveLength(1);
          for (const value of options) {
            expect(Number.isInteger(value)).toBe(true);
            expect(value).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it("case 5: deterministic for a fixed seed", () => {
    const first = buildOptions(3, 4, 4, createSeededRng(7));
    const second = buildOptions(3, 4, 4, createSeededRng(7));
    expect(first).toEqual(second);
    const third = generateQuestion(GAME, createSeededRng(7));
    const fourth = generateQuestion(GAME, createSeededRng(7));
    expect(third).toEqual(fourth);
  });
});

describe("T43 — mixed-operation questions", () => {
  const MIXED: Game = {
    ...GAME,
    id: "g-mixed-ops",
    name: "Mixed Ops",
    operations: ["add", "sub", "mul", "div"],
  };

  it("case 1: every operation appears and every question stays in range", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i += 1) {
      const question = generateQuestion(MIXED, createSeededRng(7000 + i));
      seen.add(question.operation);
      expect(question.factorA).toBeGreaterThanOrEqual(2);
      expect(question.factorA).toBeLessThanOrEqual(4);
      expect(question.factorB).toBeGreaterThanOrEqual(1);
      expect(question.factorB).toBeLessThanOrEqual(4);
      expect(question.options).toHaveLength(3);
      expect(question.options.filter((value) => value === question.rightAnswer)).toHaveLength(1);
    }
    expect([...seen].sort()).toEqual(["add", "div", "mul", "sub"]);
  });

  it("case 2: no negative subtractions, only exact divisions", () => {
    for (let i = 0; i < 200; i += 1) {
      const question = generateQuestion(MIXED, createSeededRng(9000 + i));
      if (question.operation === "sub") {
        expect(question.factorA).toBeGreaterThan(question.factorB);
        expect(question.rightAnswer).toBe(question.factorA - question.factorB);
      }
      if (question.operation === "div") {
        expect(question.factorB).toBeGreaterThanOrEqual(1);
        expect(question.factorA % question.factorB).toBe(0);
        expect(question.rightAnswer).toBe(question.factorA / question.factorB);
      }
      if (question.operation === "add") {
        expect(question.rightAnswer).toBe(question.factorA + question.factorB);
      }
      if (question.operation === "mul") {
        expect(question.rightAnswer).toBe(question.factorA * question.factorB);
      }
    }
  });

  it("case 3: a mul-only game behaves like today (only ×)", () => {
    for (let i = 0; i < 50; i += 1) {
      const question = generateQuestion(GAME, createSeededRng(i));
      expect(question.operation).toBe("mul");
      expect(question.rightAnswer).toBe(question.factorA * question.factorB);
    }
  });
});

describe("T45 — distractor options per operation", () => {
  it("case 1: 15 + 7 offers 22 once plus neighbours from {20,21,23,24,12,32}", () => {
    const allowed = new Set([20, 21, 23, 24, 12, 32]);
    for (let seed = 0; seed < 20; seed += 1) {
      const options = buildOptions(15, 7, 3, createSeededRng(seed), 22, "add");
      expect(options).toHaveLength(3);
      expect(options.filter((value) => value === 22)).toHaveLength(1);
      for (const value of options) {
        expect(value === 22 || allowed.has(value)).toBe(true);
      }
    }
  });

  it("case 2: 20 − 8 offers 12 once, all options non-negative and unique", () => {
    const options = buildOptions(20, 8, 4, createSeededRng(11), 12, "sub");
    expect(options).toHaveLength(4);
    expect(options.filter((value) => value === 12)).toHaveLength(1);
    expect(new Set(options).size).toBe(4);
    for (const value of options) {
      expect(value).toBeGreaterThanOrEqual(0);
    }
  });

  it("case 3: 20 ÷ 4 offers 5 once with small nearby distractors", () => {
    const options = buildOptions(20, 4, 3, createSeededRng(5), 5, "div");
    expect(options).toHaveLength(3);
    expect(options.filter((value) => value === 5)).toHaveLength(1);
    for (const value of options) {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
      expect(value).toBeLessThanOrEqual(10);
    }
  });

  it("case 4: exact count, unique, deterministic per seed for every operation", () => {
    const cases = [
      { a: 15, b: 7, right: 22, op: "add" },
      { a: 20, b: 8, right: 12, op: "sub" },
      { a: 3, b: 4, right: 12, op: "mul" },
      { a: 20, b: 4, right: 5, op: "div" },
    ] as const;
    for (const { a, b, right, op } of cases) {
      for (let n = 3; n <= 6; n += 1) {
        for (let seed = 0; seed < 10; seed += 1) {
          const first = buildOptions(a, b, n, createSeededRng(seed), right, op);
          const second = buildOptions(a, b, n, createSeededRng(seed), right, op);
          expect(first).toEqual(second);
          expect(first).toHaveLength(n);
          expect(new Set(first).size).toBe(n);
          expect(first.filter((value) => value === right)).toHaveLength(1);
        }
      }
    }
  });
});

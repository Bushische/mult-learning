import type { Game } from "@mult/shared";

export interface Question {
  factorA: number;
  factorB: number;
  rightAnswer: number;
  /** Exactly `variantCount` options, one of them the correct answer, shuffled. */
  options: number[];
}

/** Fisher–Yates shuffle with an injectable RNG (deterministic in tests). */
export function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const a = result[i] as T;
    const b = result[j] as T;
    result[i] = b;
    result[j] = a;
  }
  return result;
}

/**
 * Build the answer buttons: the correct answer + plausible distractors around it
 * (± small offsets, never the correct answer twice).
 */
export function buildOptions(
  rightAnswer: number,
  variantCount: number,
  rng: () => number = Math.random,
): number[] {
  const count = Math.max(2, Math.min(6, variantCount));
  const offsets = [1, -1, 2, -2, 3, -3, 4, -4, 5, -5, 10, -10];
  const options = new Set<number>([rightAnswer]);
  let index = 0;
  while (options.size < count) {
    const offset = offsets[index % offsets.length] as number;
    index += 1;
    const candidate = rightAnswer + offset;
    if (candidate < 0 || options.has(candidate)) continue;
    options.add(candidate);
    if (index > 100) break;
  }
  return shuffle([...options], rng);
}

/** All combinations the game allows (pinned list or the full range). */
export function allowedCombinations(game: Game): [number, number][] {
  if (game.allowedCombinations && game.allowedCombinations.length > 0) {
    return game.allowedCombinations;
  }
  const combos: [number, number][] = [];
  for (let a = game.rangeA.min; a <= game.rangeA.max; a += 1) {
    for (let b = game.rangeB.min; b <= game.rangeB.max; b += 1) {
      combos.push([a, b]);
    }
  }
  return combos;
}

/** Roll one question inside the game's ranges / combination list. */
export function generateQuestion(game: Game, rng: () => number = Math.random): Question {
  const combos = allowedCombinations(game);
  const pick = combos[Math.floor(rng() * combos.length)] ?? [game.rangeA.min, game.rangeB.min];
  const [factorA, factorB] = pick;
  const rightAnswer = factorA * factorB;
  return {
    factorA,
    factorB,
    rightAnswer,
    options: buildOptions(rightAnswer, game.variantCount, rng),
  };
}

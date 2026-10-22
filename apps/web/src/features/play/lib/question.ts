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
 * Build the answer buttons: the correct answer plus plausible distractors.
 * Candidates come from multiplication mistakes (`a·(b±1)`, `(a±1)·b`) and from
 * proximity (`right ±1/±2/±10`, `10·a`, `10·b`), widened with further offsets
 * when the table yields too few distinct values. Deduplicated, positive, never
 * the correct answer; `variantCount − 1` distinct picks with the injected RNG.
 */
export function buildOptions(
  factorA: number,
  factorB: number,
  variantCount: number,
  rng: () => number = Math.random,
): number[] {
  const rightAnswer = factorA * factorB;
  const count = Math.max(2, Math.min(6, variantCount));
  const raw = [
    factorA * (factorB - 1),
    factorA * (factorB + 1),
    (factorA - 1) * factorB,
    (factorA + 1) * factorB,
    rightAnswer - 1,
    rightAnswer + 1,
    rightAnswer - 2,
    rightAnswer + 2,
    rightAnswer - 10,
    rightAnswer + 10,
    10 * factorA,
    10 * factorB,
  ];
  const seen = new Set<number>();
  const pool: number[] = [];
  for (const candidate of raw) {
    if (!Number.isInteger(candidate) || candidate <= 0) continue;
    if (candidate === rightAnswer || seen.has(candidate)) continue;
    seen.add(candidate);
    pool.push(candidate);
  }
  // Tiny tables (e.g. 1 × 1) yield fewer candidates than needed — top up
  // with further offsets so the option count is always exact.
  let step = 3;
  while (pool.length < count - 1) {
    for (const candidate of [rightAnswer - step, rightAnswer + step]) {
      if (pool.length >= count - 1) break;
      if (!Number.isInteger(candidate) || candidate <= 0) continue;
      if (candidate === rightAnswer || seen.has(candidate)) continue;
      seen.add(candidate);
      pool.push(candidate);
    }
    step += 1;
  }
  const picked = shuffle(pool, rng).slice(0, count - 1);
  // The set must not be solely right ±1/±2 when table neighbours exist:
  // ensure at least one distractor differs by ≥ 3.
  const hasFar = picked.some((value) => Math.abs(value - rightAnswer) >= 3);
  if (!hasFar) {
    const far = pool.filter(
      (value) => Math.abs(value - rightAnswer) >= 3 && !picked.includes(value),
    );
    if (far.length > 0 && picked.length > 0) {
      picked[Math.floor(rng() * picked.length)] = far[0] as number;
    }
  }
  return shuffle([...picked, rightAnswer], rng);
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
    options: buildOptions(factorA, factorB, game.variantCount, rng),
  };
}

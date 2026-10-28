import { type Game, type Operation, applyOp } from "@mult/shared";

export interface Question {
  operation: Operation;
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
 *
 * `rightAnswer` overrides the implied `factorA * factorB` so mixed-operation
 * questions (T43) keep the correct answer among the buttons; per-operation
 * candidate pools arrive in T45.
 */
export function buildOptions(
  factorA: number,
  factorB: number,
  variantCount: number,
  rng: () => number = Math.random,
  rightAnswer: number = factorA * factorB,
): number[] {
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

function pickPair(pairs: [number, number][], rng: () => number): [number, number] {
  return pairs[Math.floor(rng() * pairs.length)] ?? pairs[0] ?? [1, 1];
}

/**
 * Roll operands for one operation. Subtraction is ordered `a ≥ b` (strictly
 * `a > b`: equal pairs would ask for a 0 answer, which the positive-integer
 * buttons cannot hold) and division is exact (`a % b === 0`, `b ≥ 1`).
 * Degenerate configs (e.g. a single pinned equal pair) nudge inside the
 * ranges; a truly impossible operation (no exact division exists in the
 * ranges) falls back to multiplication so the question is always valid.
 */
function rollOperands(
  game: Game,
  operation: Operation,
  combos: [number, number][],
  rng: () => number,
): { operation: Operation; factorA: number; factorB: number } {
  if (operation === "add" || operation === "mul") {
    const [factorA, factorB] = pickPair(combos, rng);
    return { operation, factorA, factorB };
  }
  if (operation === "sub") {
    const uneven = combos.filter(([x, y]) => x !== y);
    if (uneven.length > 0) {
      const [x, y] = pickPair(uneven, rng);
      return { operation, factorA: Math.max(x, y), factorB: Math.min(x, y) };
    }
    const [x, y] = pickPair(combos, rng);
    if (x < game.rangeA.max) return { operation, factorA: x + 1, factorB: x };
    if (x > game.rangeB.min && x - 1 >= 1) return { operation, factorA: x, factorB: x - 1 };
    return { operation: "mul", factorA: x, factorB: y };
  }
  const exact = combos
    .map(([x, y]): [number, number] => (x >= y ? [x, y] : [y, x]))
    .filter(([hi, lo]) => hi % lo === 0);
  if (exact.length > 0) {
    const [factorA, factorB] = pickPair(exact, rng);
    return { operation, factorA, factorB };
  }
  // No pinned pair divides evenly — synthesize any exact division in range.
  const synthesized: [number, number][] = [];
  for (let b = game.rangeB.min; b <= game.rangeB.max; b += 1) {
    for (let q = 1; q * b <= game.rangeA.max; q += 1) {
      const a = q * b;
      if (a >= game.rangeA.min) synthesized.push([a, b]);
    }
  }
  if (synthesized.length > 0) {
    const [factorA, factorB] = pickPair(synthesized, rng);
    return { operation, factorA, factorB };
  }
  const [factorA, factorB] = pickPair(combos, rng);
  return { operation: "mul", factorA, factorB };
}

/** Roll one question inside the game's ranges / combination list. */
export function generateQuestion(game: Game, rng: () => number = Math.random): Question {
  const operations = game.operations.length > 0 ? game.operations : ["mul"];
  const rolled = operations[Math.floor(rng() * operations.length)] ?? "mul";
  const combos = allowedCombinations(game);
  const { operation, factorA, factorB } = rollOperands(game, rolled, combos, rng);
  const rightAnswer = applyOp(factorA, factorB, operation);
  return {
    operation,
    factorA,
    factorB,
    rightAnswer,
    options: buildOptions(factorA, factorB, game.variantCount, rng, rightAnswer),
  };
}

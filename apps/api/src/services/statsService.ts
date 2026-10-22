import { and, eq, gte } from "drizzle-orm";
import type { DailyStats, HeatmapCell, HeatmapResponse } from "packages/shared";
import type { Db } from "../db/client.js";
import { dailyStats, matrixStats, users } from "../db/schema.js";
import { listGamesForUser } from "./gameService.js";

/** The rolling window length: 7 days. */
export const HEATMAP_WINDOW_DAYS = 7;

/** Bucket a cell by accuracy (docs/API.md). */
export function colorForAccuracy(tries: number, accuracy: number | null): HeatmapCell["color"] {
  if (tries === 0 || accuracy === null) return "none";
  if (accuracy >= 0.8) return "green";
  if (accuracy >= 0.5) return "mixed";
  return "red";
}

/** Every (a, b) combination the user's assigned games allow. */
export function combinationsForGames(db: Db, userId: string): { a: number; b: number }[] {
  const combos: { a: number; b: number }[] = [];
  const seen = new Set<string>();
  for (const game of listGamesForUser(db, userId)) {
    if (game.allowedCombinations && game.allowedCombinations.length > 0) {
      for (const [a, b] of game.allowedCombinations) {
        const key = `${a}:${b}`;
        if (seen.has(key)) continue;
        seen.add(key);
        combos.push({ a, b });
      }
      continue;
    }
    for (let a = game.rangeA.min; a <= game.rangeA.max; a += 1) {
      for (let b = game.rangeB.min; b <= game.rangeB.max; b += 1) {
        const key = `${a}:${b}`;
        if (seen.has(key)) continue;
        seen.add(key);
        combos.push({ a, b });
      }
    }
  }
  return combos;
}

/**
 * Rolling 7-day heatmap for one user: one cell per combination of the user's
 * assigned games, aggregated from `matrix_stats` inside the window.
 */
export function getHeatmap(db: Db, userId: string, now: Date = new Date()): HeatmapResponse {
  const windowStart = new Date(now.getTime() - HEATMAP_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const rows = db
    .select()
    .from(matrixStats)
    .where(and(eq(matrixStats.userId, userId), gte(matrixStats.timestamp, windowStart)))
    .all();

  const aggregates = new Map<string, { tries: number; correct: number }>();
  for (const row of rows) {
    const key = `${row.factorA}:${row.factorB}`;
    const current = aggregates.get(key) ?? { tries: 0, correct: 0 };
    current.tries += 1;
    if (row.correct) current.correct += 1;
    aggregates.set(key, current);
  }

  const cells: HeatmapCell[] = combinationsForGames(db, userId).map(({ a, b }) => {
    const aggregate = aggregates.get(`${a}:${b}`) ?? { tries: 0, correct: 0 };
    const accuracy = aggregate.tries === 0 ? null : aggregate.correct / aggregate.tries;
    return {
      a,
      b,
      tries: aggregate.tries,
      correct: aggregate.correct,
      accuracy,
      color: colorForAccuracy(aggregate.tries, accuracy),
    };
  });

  return { cells };
}

/** Today's row (or zeros for a fresh user). */
export function getDailyStats(db: Db, userId: string, now: Date = new Date()): DailyStats {
  const date = now.toISOString().slice(0, 10);
  const row = db
    .select()
    .from(dailyStats)
    .where(and(eq(dailyStats.userId, userId), eq(dailyStats.date, date)))
    .get();
  const user = db.select().from(users).where(eq(users.id, userId)).get();

  return {
    date,
    totalTries: row?.totalTries ?? 0,
    correctTries: row?.correctTries ?? 0,
    timeEarnedSeconds: row?.timeEarnedSeconds ?? 0,
    timeBankSeconds: user?.timeBankSeconds ?? 0,
  };
}

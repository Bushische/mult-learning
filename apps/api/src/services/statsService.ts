import type { DailyStats, HeatmapCell, HeatmapResponse, PerGameDailyResponse } from "@mult/shared";
import { and, eq, gte } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { dailyStats, gameDailyStats, matrixStats, users } from "../db/schema.js";
import { notFound } from "../errors.js";
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
    timeLostSeconds: row?.timeLostSeconds ?? 0,
    timeBankSeconds: user?.timeBankSeconds ?? 0,
  };
}

/**
 * Per-day per-game matrix for one user: the last `days` UTC dates ending today
 * (oldest first), each with the games that have recorded answers that day.
 * Shared by the child home screen (T30) and the admin child-stats page (T28).
 */
export function getPerGameDaily(
  db: Db,
  userId: string,
  days = 7,
  now: Date = new Date(),
): PerGameDailyResponse {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) throw notFound("User not found");

  const dates: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(now.getTime() - offset * 24 * 60 * 60 * 1000);
    dates.push(day.toISOString().slice(0, 10));
  }
  const rows = db
    .select()
    .from(gameDailyStats)
    .where(and(eq(gameDailyStats.userId, userId), gte(gameDailyStats.date, dates[0] as string)))
    .all();
  // Totals per day come from `daily_stats`, so days recorded before the
  // per-game breakdown existed (T28) still show their numbers.
  const dailyRows = db
    .select()
    .from(dailyStats)
    .where(and(eq(dailyStats.userId, userId), gte(dailyStats.date, dates[0] as string)))
    .all();
  return {
    user: { id: user.id, username: user.username, timeBankSeconds: user.timeBankSeconds },
    days: dates.map((date) => {
      const daily = dailyRows.find((row) => row.date === date);
      return {
        date,
        totals: {
          totalTries: daily?.totalTries ?? 0,
          correctTries: daily?.correctTries ?? 0,
          timeEarnedSeconds: daily?.timeEarnedSeconds ?? 0,
          timeLostSeconds: daily?.timeLostSeconds ?? 0,
        },
        games: rows
          .filter((row) => row.date === date)
          .map((row) => ({
            gameId: row.gameId,
            totalTries: row.totalTries,
            correctTries: row.correctTries,
            timeEarnedSeconds: row.timeEarnedSeconds,
            timeLostSeconds: row.timeLostSeconds,
          }))
          .sort((a, b) => a.gameId.localeCompare(b.gameId)),
      };
    }),
  };
}

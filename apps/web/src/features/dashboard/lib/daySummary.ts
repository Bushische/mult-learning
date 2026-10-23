import type { Game, PerGameDailyDay } from "@mult/shared";
import { netEarnedSeconds } from "./format";

export interface DaySummary {
  earnedSeconds: number;
  correctTries: number;
  totalTries: number;
}

/**
 * One day's net numbers for the dashboard and history: per-game rows present
 * → earned minus lost (wrong × penalty); legacy pre-T28 day (totals only) →
 * gross totals; idle → the fallback (zeros, or the daily row for today).
 */
export function summarizeDay(
  day: PerGameDailyDay | undefined,
  gamesById: Map<string, Game>,
  fallback: DaySummary,
): DaySummary {
  if (day && day.games.length > 0) {
    let earnedSeconds = 0;
    let correctTries = 0;
    let totalTries = 0;
    for (const entry of day.games) {
      const penalty = gamesById.get(entry.gameId)?.timePenalty ?? 0;
      earnedSeconds += netEarnedSeconds(
        entry.timeEarnedSeconds,
        entry.totalTries,
        entry.correctTries,
        penalty,
      );
      correctTries += entry.correctTries;
      totalTries += entry.totalTries;
    }
    return { earnedSeconds, correctTries, totalTries };
  }
  if (day && day.totals.totalTries > 0) {
    return {
      earnedSeconds: day.totals.timeEarnedSeconds,
      correctTries: day.totals.correctTries,
      totalTries: day.totals.totalTries,
    };
  }
  return fallback;
}

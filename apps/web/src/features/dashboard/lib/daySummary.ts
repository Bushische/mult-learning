import type { PerGameDailyDay } from "@mult/shared";

export interface DaySummary {
  /** Net: earned minus actually lost. */
  earnedSeconds: number;
  /** Gross earned (positive deltas only). */
  gainSeconds: number;
  /** Actually taken from the bank. */
  lostSeconds: number;
  correctTries: number;
  totalTries: number;
}

/**
 * One day's numbers: per-game rows present → recorded gain/loss (net = gain − lost);
 * legacy pre-T28 day (totals only) → gross totals; idle → fallback.
 */
export function summarizeDay(day: PerGameDailyDay | undefined, fallback: DaySummary): DaySummary {
  if (day && day.games.length > 0) {
    let gainSeconds = 0;
    let lostSeconds = 0;
    let correctTries = 0;
    let totalTries = 0;
    for (const entry of day.games) {
      gainSeconds += entry.timeEarnedSeconds;
      lostSeconds += entry.timeLostSeconds;
      correctTries += entry.correctTries;
      totalTries += entry.totalTries;
    }
    return {
      earnedSeconds: gainSeconds - lostSeconds,
      gainSeconds,
      lostSeconds,
      correctTries,
      totalTries,
    };
  }
  if (day && day.totals.totalTries > 0) {
    return {
      earnedSeconds: day.totals.timeEarnedSeconds - day.totals.timeLostSeconds,
      gainSeconds: day.totals.timeEarnedSeconds,
      lostSeconds: day.totals.timeLostSeconds,
      correctTries: day.totals.correctTries,
      totalTries: day.totals.totalTries,
    };
  }
  return fallback;
}

import type { Game, PerGameDailyDay } from "@mult/shared";
import { summarizeDay } from "../lib/daySummary";
import { formatDayLabel, formatSignedDuration } from "../lib/format";

interface HistoryListProps {
  days: PerGameDailyDay[];
  games: Game[];
}

/**
 * 7-day history: one line per day with activity — date, net earned time,
 * correct/attempts. Days with per-game rows show net; legacy pre-T28 days
 * (totals only) show the gross totals.
 */
export function HistoryList({ days, games }: HistoryListProps) {
  const gamesById = new Map(games.map((game) => [game.id, game]));
  const rows = days
    .map((day) => ({ day, summary: summarizeDay(day, gamesById, day.totals) }))
    .filter(({ summary }) => summary.totalTries > 0);
  if (rows.length === 0) {
    return null;
  }
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-lg font-bold">Last 7 days</h2>
      <ul className="flex flex-col gap-1" data-testid="history-list">
        {rows.map(({ day, summary }) => (
          <li
            key={day.date}
            data-testid={`history-day-${day.date}`}
            className="flex items-baseline gap-3"
          >
            <span className="w-16 font-semibold">{formatDayLabel(day.date)}</span>
            <span className="font-bold">{formatSignedDuration(summary.earnedSeconds)}</span>
            <span className="text-sm text-slate-500">
              {summary.correctTries}/{summary.totalTries}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

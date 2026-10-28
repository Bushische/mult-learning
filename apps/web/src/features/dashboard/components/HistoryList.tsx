import type { PerGameDailyDay } from "@mult/shared";
import { summarizeDay } from "../lib/daySummary";
import { formatDayLabel, formatDuration, formatSignedDuration } from "../lib/format";

interface HistoryListProps {
  days: PerGameDailyDay[];
}

/**
 * 7-day history: one line per day with activity — date, net earned time,
 * correct/attempts, plus gross gain and actual loss. Days with per-game rows
 * show recorded net; legacy pre-T28 days (totals only) show the gross totals.
 */
export function HistoryList({ days }: HistoryListProps) {
  const rows = [...days]
    .reverse()
    .map((day) => ({
      day,
      summary: summarizeDay(day, {
        earnedSeconds: day.totals.timeEarnedSeconds - day.totals.timeLostSeconds,
        gainSeconds: day.totals.timeEarnedSeconds,
        lostSeconds: day.totals.timeLostSeconds,
        correctTries: day.totals.correctTries,
        totalTries: day.totals.totalTries,
      }),
    }))
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
            <span className="text-sm text-slate-500">
              +{formatDuration(summary.gainSeconds)} −{formatDuration(summary.lostSeconds)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

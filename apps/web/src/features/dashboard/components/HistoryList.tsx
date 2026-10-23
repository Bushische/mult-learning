import type { PerGameDailyDay } from "@mult/shared";
import { formatDayLabel, formatDuration } from "../lib/format";

interface HistoryListProps {
  days: PerGameDailyDay[];
}

/** 7-day history: one line per active day — date, earned time, correct/attempts. */
export function HistoryList({ days }: HistoryListProps) {
  const active = days.filter((day) => day.totals.totalTries > 0);
  if (active.length === 0) {
    return null;
  }
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-lg font-bold">Last 7 days</h2>
      <ul className="flex flex-col gap-1" data-testid="history-list">
        {active.map((day) => {
          const earned = day.totals.timeEarnedSeconds;
          const tries = day.totals.totalTries;
          const correct = day.totals.correctTries;
          return (
            <li
              key={day.date}
              data-testid={`history-day-${day.date}`}
              className="flex items-baseline gap-3"
            >
              <span className="w-16 font-semibold">{formatDayLabel(day.date)}</span>
              <span className="font-bold">+{formatDuration(earned)}</span>
              <span className="text-sm text-slate-500">
                {correct}/{tries}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

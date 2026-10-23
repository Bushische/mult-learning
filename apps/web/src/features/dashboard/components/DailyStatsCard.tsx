import { formatSignedDuration } from "../lib/format";

interface DailyStatsCardProps {
  earnedSeconds: number;
  correctTries: number;
  totalTries: number;
}

/** "Today" card: one line — the net time big, the correct/attempts gray. */
export function DailyStatsCard({ earnedSeconds, correctTries, totalTries }: DailyStatsCardProps) {
  return (
    <section
      className="flex items-baseline gap-3 rounded-2xl bg-white p-4 shadow-sm"
      data-testid="daily-card"
      aria-label="Today's stats"
    >
      <h2 className="sr-only">Today</h2>
      <p className="text-3xl font-black text-emerald-700" data-testid="daily-earned">
        {formatSignedDuration(earnedSeconds)}
      </p>
      <p className="text-sm text-slate-500" data-testid="daily-tries">
        {correctTries}/{totalTries} correct today
      </p>
    </section>
  );
}

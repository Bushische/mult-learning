import { formatDuration, formatSignedDuration } from "../lib/format";

interface DailyStatsCardProps {
  earnedSeconds: number;
  correctTries: number;
  totalTries: number;
  gainSeconds: number;
  lostSeconds: number;
  avgSeconds: number;
}

/** "Today" card: net big, correct/attempts gray, then avg gain/turn and totals. */
export function DailyStatsCard({
  earnedSeconds,
  correctTries,
  totalTries,
  gainSeconds,
  lostSeconds,
  avgSeconds,
}: DailyStatsCardProps) {
  return (
    <section
      className="flex flex-col gap-1 rounded-2xl bg-white p-4 shadow-sm"
      data-testid="daily-card"
      aria-label="Today's stats"
    >
      <h2 className="sr-only">Today</h2>
      <div className="flex items-baseline gap-3">
        <p className="text-3xl font-black text-emerald-700" data-testid="daily-earned">
          {formatSignedDuration(earnedSeconds)}
        </p>
        <p className="text-sm text-slate-500" data-testid="daily-tries">
          {correctTries}/{totalTries} correct today
        </p>
      </div>
      <p className="text-sm text-slate-500" data-testid="daily-avg">
        avg {formatSignedDuration(avgSeconds)} per turn
      </p>
      <p className="text-sm text-slate-500">
        <span data-testid="daily-gain">+{formatDuration(gainSeconds)}</span> earned ·{" "}
        <span data-testid="daily-loss">−{formatDuration(lostSeconds)}</span> lost
      </p>
    </section>
  );
}

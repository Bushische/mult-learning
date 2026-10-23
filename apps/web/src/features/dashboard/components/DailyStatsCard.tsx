import type { DailyStats } from "@mult/shared";
import { formatDuration } from "../lib/format";

interface DailyStatsCardProps {
  stats: DailyStats | undefined;
}

/** "Today" card: one line — the earned time big, the correct/attempts gray. */
export function DailyStatsCard({ stats }: DailyStatsCardProps) {
  return (
    <section
      className="flex items-baseline gap-3 rounded-2xl bg-white p-4 shadow-sm"
      data-testid="daily-card"
      aria-label="Today's stats"
    >
      <h2 className="sr-only">Today</h2>
      <p className="text-3xl font-black text-emerald-700" data-testid="daily-earned">
        +{formatDuration(stats?.timeEarnedSeconds ?? 0)}
      </p>
      <p className="text-sm text-slate-500" data-testid="daily-tries">
        {stats?.correctTries ?? 0}/{stats?.totalTries ?? 0} correct today
      </p>
    </section>
  );
}

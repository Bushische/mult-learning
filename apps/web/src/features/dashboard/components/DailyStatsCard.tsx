import type { DailyStats } from "packages/shared";

interface DailyStatsCardProps {
  stats: DailyStats | undefined;
}

/** "Today" card: tries vs correct + the seconds earned today. */
export function DailyStatsCard({ stats }: DailyStatsCardProps) {
  return (
    <section
      className="rounded-2xl bg-white p-4 shadow-sm"
      data-testid="daily-card"
      aria-label="Today's stats"
    >
      <h2 className="text-lg font-bold">Today</h2>
      <p className="text-slate-700" data-testid="daily-tries">
        {stats?.totalTries ?? 0} tries · {stats?.correctTries ?? 0} correct
      </p>
      <p className="text-lg font-semibold text-emerald-700" data-testid="daily-earned">
        +{stats?.timeEarnedSeconds ?? 0}s today
      </p>
    </section>
  );
}

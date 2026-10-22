import { AppHeader } from "../components/AppHeader";
import { DailyStatsCard } from "../components/DailyStatsCard";
import { GameList } from "../components/GameList";
import { HeatmapGrid } from "../components/HeatmapGrid";
import { useDailyStats } from "../hooks/useDailyStats";
import { useGames } from "../hooks/useGames";
import { useHeatmap } from "../hooks/useHeatmap";

/** The main screen: header, heatmap, today's numbers and the assigned games. */
export function DashboardPage() {
  const { data: heatmap } = useHeatmap();
  const { data: daily } = useDailyStats();
  const { data: games } = useGames();

  return (
    <div className="min-h-screen">
      <AppHeader title="Dashboard" />
      <main className="mx-auto flex max-w-4xl flex-col gap-6 p-4">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-lg font-bold">Last 7 days</h2>
          <HeatmapGrid cells={heatmap?.cells ?? []} />
        </section>

        <DailyStatsCard stats={daily} />

        <section>
          <h2 className="mb-2 text-lg font-bold">Your games</h2>
          <GameList games={games ?? []} />
        </section>
      </main>
    </div>
  );
}

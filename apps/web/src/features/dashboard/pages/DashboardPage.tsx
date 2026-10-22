import { AppHeader } from "../components/AppHeader";
import { DailyStatsCard } from "../components/DailyStatsCard";
import { GameList } from "../components/GameList";
import { HeatmapGrid } from "../components/HeatmapGrid";
import { useDailyStats } from "../hooks/useDailyStats";
import { useGames } from "../hooks/useGames";
import { useHeatmap } from "../hooks/useHeatmap";

/** The main screen: header, heatmap, today's numbers and the assigned games. */
export function DashboardPage() {
  const heatmapQuery = useHeatmap();
  const dailyQuery = useDailyStats();
  const gamesQuery = useGames();

  const offline = heatmapQuery.isError || dailyQuery.isError || gamesQuery.isError;

  return (
    <div className="min-h-screen">
      <AppHeader title="Dashboard" />
      <main className="mx-auto flex max-w-4xl flex-col gap-6 p-4">
        {offline ? (
          <output
            data-testid="offline-banner"
            className="rounded-2xl bg-amber-100 px-4 py-3 font-semibold text-amber-900"
          >
            You are offline — the server cannot be reached. No cached data is shown.
          </output>
        ) : null}

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-lg font-bold">Last 7 days</h2>
          <HeatmapGrid cells={heatmapQuery.data?.cells ?? []} />
        </section>

        <DailyStatsCard stats={dailyQuery.data} />

        <section>
          <h2 className="mb-2 text-lg font-bold">Your games</h2>
          <GameList games={gamesQuery.data ?? []} />
        </section>
      </main>
    </div>
  );
}

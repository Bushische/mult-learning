import type { Game } from "@mult/shared";
import { AppHeader } from "../components/AppHeader";
import { DailyStatsCard } from "../components/DailyStatsCard";
import { GameList } from "../components/GameList";
import { HeatmapGrid } from "../components/HeatmapGrid";
import { HistoryList } from "../components/HistoryList";
import { useDailyStats } from "../hooks/useDailyStats";
import { useGames } from "../hooks/useGames";
import { useHeatmap } from "../hooks/useHeatmap";
import { usePerGame } from "../hooks/usePerGame";
import { summarizeDay } from "../lib/daySummary";

/** The main screen: today card, per-game results, 7-day history, heatmap. */
export function DashboardPage() {
  const heatmapQuery = useHeatmap();
  const dailyQuery = useDailyStats();
  const gamesQuery = useGames();
  const perGameQuery = usePerGame();

  const offline =
    heatmapQuery.isError || dailyQuery.isError || gamesQuery.isError || perGameQuery.isError;

  const games = gamesQuery.data ?? [];
  const gamesById = new Map(games.map((game) => [game.id, game]));
  const days = perGameQuery.data?.days ?? [];
  const todayEntry = days[days.length - 1];
  const todayGames = todayEntry?.games ?? [];
  const todayByGame = Object.fromEntries(
    todayGames.map((entry) => [
      entry.gameId,
      {
        earnedSeconds: entry.timeEarnedSeconds,
        correctTries: entry.correctTries,
        totalTries: entry.totalTries,
      },
    ]),
  );
  const daily = dailyQuery.data;
  const today = summarizeDay(todayEntry, gamesById, {
    earnedSeconds: daily?.timeEarnedSeconds ?? 0,
    correctTries: daily?.correctTries ?? 0,
    totalTries: daily?.totalTries ?? 0,
  });

  return (
    <div className="min-h-screen">
      <AppHeader title="Dashboard" todayNet={today.earnedSeconds} />
      <main className="mx-auto flex max-w-4xl flex-col gap-6 p-4">
        {offline ? (
          <output
            data-testid="offline-banner"
            className="rounded-2xl bg-amber-100 px-4 py-3 font-semibold text-amber-900"
          >
            You are offline — the server cannot be reached. No cached data is shown.
          </output>
        ) : null}

        <DailyStatsCard
          earnedSeconds={today.earnedSeconds}
          correctTries={today.correctTries}
          totalTries={today.totalTries}
        />

        <section>
          <h2 className="mb-2 text-lg font-bold">Your games</h2>
          <GameList games={games} todayByGame={todayByGame} />
        </section>

        <HistoryList days={days} games={games} />

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-lg font-bold">Heatmap</h2>
          <HeatmapGrid cells={heatmapQuery.data?.cells ?? []} />
        </section>
      </main>
    </div>
  );
}

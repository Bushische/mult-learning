import { Link, useParams } from "react-router-dom";
import { AppHeader } from "../../dashboard/components/AppHeader";
import { HeatmapGrid } from "../../dashboard/components/HeatmapGrid";
import { formatDuration } from "../../dashboard/lib/format";
import { useAdminGames, useAdminUserStats, useAdminUsers } from "../hooks/useAdminData";

/**
 * One child's stats page: username, current bank, assigned games, the rolling
 * 7-day heatmap and the 7-day usage totals.
 */
export function UserStatsPage() {
  const { id } = useParams();
  const { data: users } = useAdminUsers();
  const { data: games } = useAdminGames();
  const { data: stats } = useAdminUserStats(id);

  if (users === undefined) {
    return (
      <div className="min-h-screen">
        <AppHeader title="Child stats" />
        <main className="p-6">
          <p className="text-slate-500">Loading…</p>
        </main>
      </div>
    );
  }

  const user = users.find((entry) => entry.id === id);
  if (!user) {
    return (
      <div className="min-h-screen">
        <AppHeader title="Child stats" />
        <main className="p-6">
          <p className="text-lg text-slate-600" data-testid="user-not-found">
            User not found
          </p>
          <Link to="/admin" className="text-sky-700 underline">
            Back to admin
          </Link>
        </main>
      </div>
    );
  }

  const assignedGames = (games ?? []).filter((game) => user.games.includes(game.id));
  const summary = stats?.last7Days;

  return (
    <div className="min-h-screen">
      <AppHeader title="Child stats" />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold" data-testid="user-stats-name">
            {user.username}
          </h2>
          <p className="text-slate-600" data-testid="user-stats-bank">
            {formatDuration(user.timeBankSeconds)} bank
          </p>
          <div data-testid="user-stats-games">
            {assignedGames.length === 0 ? (
              <p className="text-slate-500">No games assigned.</p>
            ) : (
              <ul>
                {assignedGames.map((game) => (
                  <li key={game.id}>{game.name}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
        <section className="rounded-2xl bg-white p-4 shadow-sm" data-testid="week-summary">
          <h3 className="mb-2 text-lg font-bold">Last 7 days</h3>
          <ul className="flex flex-col gap-1">
            <li data-testid="week-attempts">Attempts: {summary?.attempts ?? 0}</li>
            <li data-testid="week-correct">Correct: {summary?.correct ?? 0}</li>
            <li data-testid="week-incorrect">Incorrect: {summary?.incorrect ?? 0}</li>
            <li data-testid="week-earned">Earned: {formatDuration(summary?.earnedSeconds ?? 0)}</li>
          </ul>
        </section>
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h3 className="mb-2 text-lg font-bold">Heatmap</h3>
          <HeatmapGrid cells={stats?.heatmap ?? []} />
        </section>
        <Link
          to="/admin"
          data-testid="back-to-admin"
          className="min-h-[44px] self-start rounded-xl border border-slate-300 px-4 py-2"
        >
          Back to admin
        </Link>
      </main>
    </div>
  );
}

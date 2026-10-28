import { Link, useParams } from "react-router-dom";
import { AppHeader } from "../../dashboard/components/AppHeader";
import { HeatmapGrid } from "../../dashboard/components/HeatmapGrid";
import { summarizeDay } from "../../dashboard/lib/daySummary";
import { formatDayLabel, formatDuration, formatSignedDuration } from "../../dashboard/lib/format";
import {
  useAdminGames,
  useAdminPerGame,
  useAdminUserStats,
  useAdminUsers,
} from "../hooks/useAdminData";

/**
 * One child's stats page: username, today's earnings, per-game results today,
 * the rolling 7-day heatmap, the 7-day day×game table and the 7-day usage totals.
 */
export function UserStatsPage() {
  const { id } = useParams();
  const { data: users } = useAdminUsers();
  const { data: games } = useAdminGames();
  const { data: stats } = useAdminUserStats(id);
  const { data: perGame } = useAdminPerGame(id);

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
  const days = perGame?.days ?? [];
  const todayEntry = days[days.length - 1];
  const today = summarizeDay(todayEntry, {
    earnedSeconds: 0,
    gainSeconds: 0,
    lostSeconds: 0,
    correctTries: 0,
    totalTries: 0,
  });
  const todayAvg = today.totalTries > 0 ? Math.round(today.gainSeconds / today.totalTries) : 0;
  const todayGames = todayEntry?.games ?? [];
  const todayEarned = today.earnedSeconds;
  const todayTries = today.totalTries;
  const todayCorrect = today.correctTries;

  return (
    <div className="min-h-screen">
      <AppHeader title="Child stats" />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold" data-testid="user-stats-name">
            {user.username}
          </h2>
          <p className="text-2xl font-black text-slate-900" data-testid="user-stats-today">
            {formatSignedDuration(todayEarned)}{" "}
            <span className="text-base font-semibold text-slate-500">today</span>
          </p>
          <p className="text-sm text-slate-500">
            {todayCorrect}/{todayTries} correct today
          </p>
          <p className="text-sm text-slate-500" data-testid="user-stats-pace">
            avg {formatSignedDuration(todayAvg)} per turn · +{formatDuration(today.gainSeconds)}{" "}
            earned · −{formatDuration(today.lostSeconds)} lost
          </p>
          <p className="text-slate-600" data-testid="user-stats-bank">
            {formatDuration(user.timeBankSeconds)} bank
          </p>
          <div data-testid="user-stats-games">
            {assignedGames.length === 0 ? (
              <p className="text-slate-500">No games assigned.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-1">
                {assignedGames.map((game) => {
                  const entry = todayGames.find((row) => row.gameId === game.id);
                  return (
                    <li key={game.id} data-testid={`today-game-${game.id}`}>
                      <span className="font-semibold">{game.name}</span>{" "}
                      <span className="text-slate-600">
                        +{formatDuration(entry?.timeEarnedSeconds ?? 0)} ·{" "}
                        {entry?.correctTries ?? 0}/{entry?.totalTries ?? 0} today
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
        {assignedGames.length > 0 ? (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h3 className="mb-2 text-lg font-bold">Last 7 days per game</h3>
            <table className="w-full text-left" data-testid="week-table">
              <thead>
                <tr className="border-b border-slate-200 text-sm text-slate-500">
                  <th scope="col" className="py-2">
                    Day
                  </th>
                  <th scope="col" className="py-2">
                    Total
                  </th>
                  {assignedGames.map((game) => (
                    <th key={game.id} scope="col" className="py-2">
                      {game.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...days].reverse().map((day) => {
                  const summary = summarizeDay(day, {
                    earnedSeconds: 0,
                    gainSeconds: 0,
                    lostSeconds: 0,
                    correctTries: 0,
                    totalTries: 0,
                  });
                  return (
                    <tr key={day.date} data-testid={`week-row-${day.date}`}>
                      <td className="py-2 font-semibold">{formatDayLabel(day.date)}</td>
                      <td className="py-2 font-semibold" data-testid={`week-total-${day.date}`}>
                        {summary.totalTries > 0
                          ? `${formatSignedDuration(summary.earnedSeconds)} · ${summary.correctTries}/${summary.totalTries} (+${formatDuration(summary.gainSeconds)} −${formatDuration(summary.lostSeconds)})`
                          : "—"}
                      </td>
                      {assignedGames.map((game) => {
                        const entry = day.games.find((row) => row.gameId === game.id);
                        return (
                          <td
                            key={game.id}
                            className="py-2"
                            data-testid={`week-cell-${day.date}-${game.id}`}
                          >
                            {entry
                              ? `+${formatDuration(entry.timeEarnedSeconds)} · ${entry.correctTries}/${entry.totalTries}`
                              : "—"}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ) : null}
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

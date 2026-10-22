import { useState } from "react";
import { queryClient } from "../../../lib/query-client";
import { AppHeader } from "../../dashboard/components/AppHeader";
import {
  assignAdminGames,
  createAdminUser,
  deleteAdminUser,
  resetAdminUser,
  updateAdminUser,
} from "../api";
import { LeaderboardTable } from "../components/LeaderboardTable";
import { StatsTab } from "../components/StatsTab";
import { UsersTab } from "../components/UsersTab";
import { GameStudioPage } from "../games/pages/GameStudioPage";
import { useAdminDaily, useAdminGames, useAdminUsers, useLeaderboard } from "../hooks/useAdminData";

type Tab = "dashboard" | "users" | "stats" | "games";

/** The admin panel: leaderboard, user management, stats + reset. */
export function AdminPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const { data: users } = useAdminUsers();
  const { data: games } = useAdminGames();
  const { data: leaderboard } = useLeaderboard();
  const { data: daily } = useAdminDaily();

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin"] });
    await queryClient.invalidateQueries({ queryKey: ["me"] });
  };

  return (
    <div className="min-h-screen">
      <AppHeader title="Admin" />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4">
        <nav className="flex gap-2" data-testid="admin-tabs">
          {(
            [
              ["dashboard", "Dashboard"],
              ["users", "Users"],
              ["stats", "Stats"],
              ["games", "Games"],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`min-h-[48px] rounded-xl px-4 text-lg font-bold ${
                tab === key ? "bg-slate-800 text-white" : "bg-white text-slate-700"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {tab === "dashboard" ? (
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-lg font-bold">Leaderboard (7 days)</h2>
            <LeaderboardTable rows={leaderboard ?? []} />
          </section>
        ) : null}

        {tab === "users" ? (
          <UsersTab
            users={users ?? []}
            games={games ?? []}
            onCreate={(payload) => {
              void createAdminUser(payload).then(refresh);
            }}
            onSave={(id, patch) => {
              void updateAdminUser(id, patch).then(refresh);
            }}
            onDelete={(id) => {
              void deleteAdminUser(id).then(refresh);
            }}
            onAssign={(id, gameIds) => {
              void assignAdminGames(id, gameIds).then(refresh);
            }}
            onReset={(id) => {
              void resetAdminUser(id).then(refresh);
            }}
          />
        ) : null}

        {tab === "stats" ? <StatsTab rows={daily ?? []} /> : null}

        {tab === "games" ? <GameStudioPage /> : null}
      </main>
    </div>
  );
}

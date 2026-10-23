import type { Game } from "@mult/shared";
import { useNavigate } from "react-router-dom";
import { formatDuration } from "../lib/format";

export interface GameToday {
  earnedSeconds: number;
  correctTries: number;
  totalTries: number;
}

interface GameListProps {
  games: Game[];
  /** Today's numbers per game id (from the per-day per-game matrix). */
  todayByGame?: Record<string, GameToday>;
}

/** The assigned games with today's results + a big "Let's Play!" button. */
export function GameList({ games, todayByGame = {} }: GameListProps) {
  const navigate = useNavigate();

  if (games.length === 0) {
    return <p className="text-slate-500">No games assigned yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-3" data-testid="game-list">
      {games.map((game) => {
        const today = todayByGame[game.id] ?? { earnedSeconds: 0, correctTries: 0, totalTries: 0 };
        const wrongTries = today.totalTries - today.correctTries;
        const lostSeconds = wrongTries * game.timePenalty;
        return (
          <li
            key={game.id}
            className="flex items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow-sm"
            data-testid={`game-${game.id}`}
          >
            <div className="flex flex-col gap-1">
              <p className="text-lg font-bold">{game.name}</p>
              <p className="text-slate-600" data-testid={`game-economics-${game.id}`}>
                +{game.baseTimeReward}s correct / −{game.timePenalty}s wrong
              </p>
              <p className="font-semibold text-green-600" data-testid={`game-correct-${game.id}`}>
                Correct{" "}
                <span className="rounded-full bg-green-100 px-3 py-0.5 font-bold">
                  +{formatDuration(today.earnedSeconds)}
                </span>
              </p>
              <p className="font-semibold text-red-600" data-testid={`game-wrong-${game.id}`}>
                Wrong{" "}
                <span className="rounded-full bg-pink-100 px-3 py-0.5 font-bold text-pink-700">
                  −{formatDuration(lostSeconds)}
                </span>
              </p>
              <p className="text-slate-700" data-testid={`game-total-${game.id}`}>
                Today: +{formatDuration(today.earnedSeconds)} ({today.correctTries}/
                {today.totalTries})
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/play/${game.id}`)}
              className="min-h-[56px] rounded-2xl bg-sky-500 px-6 text-lg font-bold text-white shadow-sm"
            >
              Let&apos;s Play!
            </button>
          </li>
        );
      })}
    </ul>
  );
}

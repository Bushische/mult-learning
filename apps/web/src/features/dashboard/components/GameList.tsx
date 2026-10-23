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
        return (
          <li
            key={game.id}
            className="flex items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow-sm"
            data-testid={`game-${game.id}`}
          >
            <div>
              <p className="text-lg font-bold">{game.name}</p>
              <p className="text-slate-600" data-testid={`game-economics-${game.id}`}>
                +{game.baseTimeReward}s correct / −{game.timePenalty}s wrong
              </p>
              <p className="text-sm text-slate-500" data-testid={`game-today-${game.id}`}>
                +{formatDuration(today.earnedSeconds)} · {today.correctTries}/{today.totalTries}{" "}
                today
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

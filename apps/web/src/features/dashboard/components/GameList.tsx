import type { Game } from "packages/shared";
import { useNavigate } from "react-router-dom";

interface GameListProps {
  games: Game[];
}

/** The assigned games with their economics + a big "Let's Play!" button. */
export function GameList({ games }: GameListProps) {
  const navigate = useNavigate();

  if (games.length === 0) {
    return <p className="text-slate-500">No games assigned yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-3" data-testid="game-list">
      {games.map((game) => (
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
          </div>
          <button
            type="button"
            onClick={() => navigate(`/play/${game.id}`)}
            className="min-h-[56px] rounded-2xl bg-sky-500 px-6 text-lg font-bold text-white shadow-sm"
          >
            Let&apos;s Play!
          </button>
        </li>
      ))}
    </ul>
  );
}

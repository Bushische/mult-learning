import type { Game } from "@mult/shared";

interface GameListProps {
  games: Game[];
  onEdit: (game: Game) => void;
  onDuplicate: (game: Game) => void;
  onDelete: (game: Game) => void;
}

/** The list of games: edit, duplicate, delete. */
export function GameList({ games, onEdit, onDuplicate, onDelete }: GameListProps) {
  if (games.length === 0) {
    return <p className="text-slate-500">No games yet.</p>;
  }
  return (
    <ul className="flex flex-col gap-2" data-testid="game-list">
      {games.map((game) => (
        <li
          key={game.id}
          className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white p-3 shadow-sm"
          data-testid={`admin-game-${game.name}`}
        >
          <div>
            <p className="font-bold">{game.name}</p>
            <p className="text-sm text-slate-500">
              {game.rangeA.min}–{game.rangeA.max} × {game.rangeB.min}–{game.rangeB.max} ·{" "}
              {game.variantCount} options · +{game.baseTimeReward}s / −{game.timePenalty}s
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onEdit(game)}
              className="min-h-[44px] rounded-xl border border-slate-300 px-3"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onDuplicate(game)}
              className="min-h-[44px] rounded-xl border border-slate-300 px-3"
            >
              Duplicate
            </button>
            <button
              type="button"
              onClick={() => onDelete(game)}
              className="min-h-[44px] rounded-xl border border-red-300 px-3 text-red-700"
            >
              Delete
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

import type { Game, GameConfig } from "packages/shared";
import { useState } from "react";
import { queryClient } from "../../../../lib/query-client";
import { useAdminGames } from "../../hooks/useAdminData";
import { createGame, deleteGame, updateGame } from "../api";
import { GameList } from "../components/GameList";
import { GameStudioForm } from "../components/GameStudioForm";

/** The game studio: list + create / edit / duplicate / delete. */
export function GameStudioPage() {
  const { data: games } = useAdminGames();
  const [editing, setEditing] = useState<Game | null>(null);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["admin", "games"] });
    await queryClient.invalidateQueries({ queryKey: ["games"] });
  };

  const handleSubmit = (config: GameConfig) => {
    if (editing) {
      void updateGame(editing.id, config).then(refresh);
      setEditing(null);
      return;
    }
    void createGame(config).then(refresh);
  };

  const duplicate = (game: Game) => {
    void createGame({
      name: `copy of ${game.name}`,
      rangeA: game.rangeA,
      rangeB: game.rangeB,
      allowedCombinations: game.allowedCombinations,
      variantCount: game.variantCount,
      baseTimeReward: game.baseTimeReward,
      timePenalty: game.timePenalty,
      maxDailyTime: game.maxDailyTime,
      hints: game.hints,
    }).then(refresh);
  };

  return (
    <section className="flex flex-col gap-4" data-testid="game-studio-page">
      <GameStudioForm
        editing={editing}
        onSubmit={handleSubmit}
        onCancelEdit={() => setEditing(null)}
      />
      <GameList
        games={games ?? []}
        onEdit={setEditing}
        onDuplicate={duplicate}
        onDelete={(game) => {
          void deleteGame(game.id).then(refresh);
        }}
      />
    </section>
  );
}

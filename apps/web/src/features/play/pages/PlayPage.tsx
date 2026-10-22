import { useParams } from "react-router-dom";
import { AppHeader } from "../../dashboard/components/AppHeader";

/** Play screen — the real game loop lands in T12. */
export function PlayPage() {
  const { gameId } = useParams();
  return (
    <div className="min-h-screen">
      <AppHeader title="Playing" />
      <main className="p-6">
        <p className="text-lg text-slate-600">Game {gameId}</p>
      </main>
    </div>
  );
}

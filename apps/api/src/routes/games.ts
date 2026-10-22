import { gamesListSchema } from "@mult/shared";
import type { FastifyInstance } from "fastify";
import { requireAuth, requireAuthUser } from "../plugins/auth.js";
import { listAllGames, listGamesForUser } from "../services/gameService.js";

/** Game routes — mounted under `/api`. */
export async function gameRoutes(app: FastifyInstance): Promise<void> {
  /**
   * `GET /games` — a `user` sees only the games assigned to them,
   * an `admin` sees every game.
   */
  app.get("/games", { preHandler: requireAuth }, async (request) => {
    const authUser = requireAuthUser(request);
    const list =
      authUser.role === "admin" ? listAllGames(app.db) : listGamesForUser(app.db, authUser.id);
    return gamesListSchema.parse(list);
  });
}

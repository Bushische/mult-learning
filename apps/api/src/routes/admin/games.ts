import type { FastifyInstance } from "fastify";
import {
  adminDailyRowsSchema,
  adminStatsDailyQuerySchema,
  gameConfigSchema,
  gamePatchSchema,
  gameSchema,
  gamesListSchema,
  leaderboardSchema,
} from "packages/shared";
import { requireAdmin } from "../../plugins/auth.js";
import {
  createGame,
  deleteGame,
  listAdminGames,
  updateGame,
} from "../../services/adminGameService.js";
import { getAdminDailyStats, getLeaderboard } from "../../services/adminStatsService.js";
import { parseOrThrow } from "../../validation.js";

interface IdParams {
  id: string;
}

/** Admin game + stats routes — mounted under `/api/admin`. */
export async function adminGameRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAdmin);

  /** All games. */
  app.get("/games", async () => gamesListSchema.parse(listAdminGames(app.db)));

  /** Create a game. */
  app.post("/games", async (request, reply) => {
    const body = parseOrThrow(gameConfigSchema, {
      allowedCombinations: null,
      hints: [],
      ...(request.body as Record<string, unknown>),
    });
    const created = createGame(app.db, body);
    return reply.status(201).send(gameSchema.parse(created));
  });

  /** Patch a game. */
  app.patch("/games/:id", async (request) => {
    const { id } = request.params as IdParams;
    const body = parseOrThrow(gamePatchSchema, request.body);
    return gameSchema.parse(updateGame(app.db, id, body));
  });

  /** Delete a game (cascades the assignments). */
  app.delete("/games/:id", async (request, reply) => {
    const { id } = request.params as IdParams;
    deleteGame(app.db, id);
    return reply.status(204).send();
  });

  /** 7-day leaderboard. */
  app.get("/leaderboard", async () => leaderboardSchema.parse(getLeaderboard(app.db)));

  /** Daily overview (default: today). */
  app.get("/stats/daily", async (request) => {
    const query = parseOrThrow(adminStatsDailyQuerySchema, request.query ?? {});
    const date = query.date ?? new Date().toISOString().slice(0, 10);
    return adminDailyRowsSchema.parse(getAdminDailyStats(app.db, date));
  });
}

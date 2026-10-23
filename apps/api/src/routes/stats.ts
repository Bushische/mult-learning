import {
  dailyStatsSchema,
  heatmapResponseSchema,
  perGameDailyQuerySchema,
  perGameDailyResponseSchema,
} from "@mult/shared";
import type { FastifyInstance } from "fastify";
import { requireAuth, requireAuthUser } from "../plugins/auth.js";
import { getDailyStats, getHeatmap, getPerGameDaily } from "../services/statsService.js";
import { parseOrThrow } from "../validation.js";

/** Stats routes — mounted under `/api`. */
export async function statsRoutes(app: FastifyInstance): Promise<void> {
  /** Rolling 7-day heatmap of the signed-in user. */
  app.get("/stats/heatmap", { preHandler: requireAuth }, async (request) => {
    const authUser = requireAuthUser(request);
    return heatmapResponseSchema.parse(getHeatmap(app.db, authUser.id));
  });

  /** Today's stats of the signed-in user. */
  app.get("/stats/daily", { preHandler: requireAuth }, async (request) => {
    const authUser = requireAuthUser(request);
    return dailyStatsSchema.parse(getDailyStats(app.db, authUser.id));
  });

  /** Per-day per-game matrix of the signed-in user (last N days, default 7). */
  app.get("/stats/per-game", { preHandler: requireAuth }, async (request) => {
    const authUser = requireAuthUser(request);
    const query = parseOrThrow(perGameDailyQuerySchema, request.query ?? {});
    return perGameDailyResponseSchema.parse(getPerGameDaily(app.db, authUser.id, query.days ?? 7));
  });
}

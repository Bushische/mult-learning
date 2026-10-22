import { dailyStatsSchema, heatmapResponseSchema } from "@mult/shared";
import type { FastifyInstance } from "fastify";
import { requireAuth, requireAuthUser } from "../plugins/auth.js";
import { getDailyStats, getHeatmap } from "../services/statsService.js";

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
}

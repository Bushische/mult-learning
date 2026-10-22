import {
  adminUserSchema,
  adminUserStatsResponseSchema,
  adminUsersListSchema,
  assignGamesRequestSchema,
  createUserRequestSchema,
  gameIdsListSchema,
  updateUserRequestSchema,
} from "@mult/shared";
import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../plugins/auth.js";
import { getAdminUserStats } from "../../services/adminStatsService.js";
import {
  createUser,
  deleteUser,
  listAdminUsers,
  resetUserProgress,
  setUserGames,
  updateUser,
} from "../../services/adminUserService.js";
import { parseOrThrow } from "../../validation.js";

interface IdParams {
  id: string;
}

/** Admin user routes — mounted under `/api/admin`. */
export async function adminUserRoutes(app: FastifyInstance): Promise<void> {
  app.addHook("preHandler", requireAdmin);

  /** All users with their assigned games. */
  app.get("/users", async () => adminUsersListSchema.parse(listAdminUsers(app.db)));

  /** Create a user. */
  app.post("/users", async (request, reply) => {
    const body = parseOrThrow(createUserRequestSchema, request.body);
    const created = createUser(app.db, body);
    return reply.status(201).send(adminUserSchema.parse(created));
  });

  /** Update username / PIN / role. */
  app.patch("/users/:id", async (request) => {
    const { id } = request.params as IdParams;
    const body = parseOrThrow(updateUserRequestSchema, request.body);
    return adminUserSchema.parse(updateUser(app.db, id, body));
  });

  /** Delete a user (cascades assignments + stats). */
  app.delete("/users/:id", async (request, reply) => {
    const { id } = request.params as IdParams;
    deleteUser(app.db, id);
    return reply.status(204).send();
  });

  /** Replace the game assignments of a user. */
  app.put("/users/:id/games", async (request) => {
    const { id } = request.params as IdParams;
    const body = parseOrThrow(assignGamesRequestSchema, request.body);
    return gameIdsListSchema.parse(setUserGames(app.db, id, body.gameIds));
  });

  /** Reset progress / heatmap of a user. */
  app.post("/users/:id/reset", async (request, reply) => {
    const { id } = request.params as IdParams;
    resetUserProgress(app.db, id);
    return reply.status(204).send();
  });

  /** One child's stats: identity + rolling heatmap + 7-day totals. */
  app.get("/users/:id/stats", async (request) => {
    const { id } = request.params as IdParams;
    return adminUserStatsResponseSchema.parse(getAdminUserStats(app.db, id));
  });
}

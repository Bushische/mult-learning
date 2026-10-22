import type { FastifyInstance } from "fastify";
import { meSchema, usersListSchema } from "packages/shared";
import { notFound } from "../errors.js";
import { requireAuth, requireAuthUser } from "../plugins/auth.js";
import { findUserById, listLoginGridUsers, toMe } from "../services/userService.js";

/** Session routes — mounted under `/api`. */
export async function userRoutes(app: FastifyInstance): Promise<void> {
  /** Public login grid: ids + usernames only. */
  app.get("/users", async () => usersListSchema.parse(listLoginGridUsers(app.db)));

  /** The signed-in user (username, role, time bank). */
  app.get("/me", { preHandler: requireAuth }, async (request) => {
    const authUser = requireAuthUser(request);
    const user = findUserById(app.db, authUser.id);
    if (!user) throw notFound("User not found");
    return meSchema.parse(toMe(user));
  });
}

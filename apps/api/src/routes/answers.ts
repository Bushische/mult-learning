import { answerRequestSchema, answerResponseSchema } from "@mult/shared";
import type { FastifyInstance } from "fastify";
import { requireAuth, requireAuthUser } from "../plugins/auth.js";
import { submitAnswer } from "../services/answerService.js";
import { parseOrThrow } from "../validation.js";

/** Answer routes — mounted under `/api`. */
export async function answerRoutes(app: FastifyInstance): Promise<void> {
  /** `POST /answers` — the only write path for activity. */
  app.post("/answers", { preHandler: requireAuth }, async (request) => {
    const authUser = requireAuthUser(request);
    const body = parseOrThrow(answerRequestSchema, request.body);
    return answerResponseSchema.parse(submitAnswer(app.db, authUser.id, body));
  });
}

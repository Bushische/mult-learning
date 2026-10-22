import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { FastifyHttpError } from "../errors.js";

/** Shape of every error response (docs/API.md). */
export interface ErrorBody {
  error: {
    code: string;
    message: string;
  };
}

function formatZodError(error: ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}

function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
): FastifyReply {
  const body: ErrorBody = { error: { code, message } };
  return reply.status(statusCode).send(body);
}

/**
 * Centralized error handling:
 * - `FastifyHttpError` → its status/code
 * - zod failures → 400 VALIDATION_ERROR
 * - unknown routes → 404 NOT_FOUND
 * - everything else → 500 (logged, generic message)
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler(
    (
      error: Error & { statusCode?: number; validation?: unknown },
      request: FastifyRequest,
      reply,
    ) => {
      if (error instanceof FastifyHttpError) {
        return sendError(reply, error.statusCode, error.code, error.message);
      }
      if (error instanceof ZodError) {
        return sendError(reply, 400, "VALIDATION_ERROR", formatZodError(error));
      }
      if (error.validation) {
        return sendError(reply, 400, "VALIDATION_ERROR", error.message);
      }
      if (error.statusCode && error.statusCode < 500) {
        return sendError(reply, error.statusCode, "VALIDATION_ERROR", error.message);
      }
      request.log.error({ err: error }, "unhandled error");
      return sendError(reply, 500, "INTERNAL_SERVER_ERROR", "Internal server error");
    },
  );

  app.setNotFoundHandler((request, reply) =>
    sendError(reply, 404, "NOT_FOUND", `Route ${request.method} ${request.url} not found`),
  );
}

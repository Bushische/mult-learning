/**
 * Application error type. Every expected failure is thrown as a
 * `FastifyHttpError` and mapped by the centralized error handler to
 * `{ "error": { "code", "message" } }` (docs/API.md).
 */
export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class FastifyHttpError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;

  constructor(statusCode: number, code: ErrorCode, message: string) {
    super(message);
    this.name = "FastifyHttpError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const validationError = (message: string): FastifyHttpError =>
  new FastifyHttpError(400, "VALIDATION_ERROR", message);

export const unauthorized = (message = "Authentication required"): FastifyHttpError =>
  new FastifyHttpError(401, "UNAUTHORIZED", message);

export const forbidden = (message = "Not allowed"): FastifyHttpError =>
  new FastifyHttpError(403, "FORBIDDEN", message);

export const notFound = (message = "Resource not found"): FastifyHttpError =>
  new FastifyHttpError(404, "NOT_FOUND", message);

export const conflict = (message = "Resource conflict"): FastifyHttpError =>
  new FastifyHttpError(409, "CONFLICT", message);

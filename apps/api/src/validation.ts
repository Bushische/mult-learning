import type { z } from "zod";
import { validationError } from "./errors.js";

/**
 * Parse an untrusted payload with a zod schema. Failures become
 * 400 VALIDATION_ERROR (the error handler renders the zod issues).
 */
export function parseOrThrow<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => {
        const path = issue.path.join(".");
        return path ? `${path}: ${issue.message}` : issue.message;
      })
      .join("; ");
    throw validationError(message || "Invalid request payload");
  }
  return result.data;
}

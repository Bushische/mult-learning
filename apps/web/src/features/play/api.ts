import {
  type AnswerResponse,
  type Operation,
  answerRequestSchema,
  answerResponseSchema,
} from "@mult/shared";
import { api } from "../../lib/api-client";
import { queryClient } from "../../lib/query-client";

/**
 * Submit one answer. The server is authoritative — the response carries the
 * new time bank. The dashboard caches are invalidated afterwards.
 */
export async function submitAnswer(payload: {
  gameId: string;
  operation?: Operation;
  factorA: number;
  factorB: number;
  chosen: number | null;
  elapsedMs: number;
}): Promise<AnswerResponse> {
  const body = answerRequestSchema.parse(payload);
  const result = await api.post<AnswerResponse>("/answers", body, answerResponseSchema);
  await queryClient.invalidateQueries({ queryKey: ["me"] });
  await queryClient.invalidateQueries({ queryKey: ["daily"] });
  await queryClient.invalidateQueries({ queryKey: ["heatmap"] });
  await queryClient.invalidateQueries({ queryKey: ["per-game"] });
  return result;
}

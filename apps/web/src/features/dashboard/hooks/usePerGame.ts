import { type PerGameDailyResponse, perGameDailyResponseSchema } from "@mult/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api-client";

/** Per-day per-game matrix of the signed-in child (today card, games, history). */
export function usePerGame() {
  return useQuery({
    queryKey: ["per-game"],
    refetchInterval: 15_000, // live stat pages: refresh while open
    queryFn: () => api.get<PerGameDailyResponse>("/stats/per-game", perGameDailyResponseSchema),
  });
}

import { type DailyStats, dailyStatsSchema } from "@mult/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api-client";

/** Today's stats of the signed-in child. */
export function useDailyStats() {
  return useQuery({
    queryKey: ["daily"],
    refetchInterval: 15_000, // live stat pages: refresh while open
    queryFn: () => api.get<DailyStats>("/stats/daily", dailyStatsSchema),
  });
}

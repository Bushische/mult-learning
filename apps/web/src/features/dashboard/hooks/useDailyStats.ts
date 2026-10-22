import { type DailyStats, dailyStatsSchema } from "@mult/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api-client";

/** Today's stats of the signed-in child. */
export function useDailyStats() {
  return useQuery({
    queryKey: ["daily"],
    queryFn: () => api.get<DailyStats>("/stats/daily", dailyStatsSchema),
  });
}

import { useQuery } from "@tanstack/react-query";
import { type DailyStats, dailyStatsSchema } from "packages/shared";
import { api } from "../../../lib/api-client";

/** Today's stats of the signed-in child. */
export function useDailyStats() {
  return useQuery({
    queryKey: ["daily"],
    queryFn: () => api.get<DailyStats>("/stats/daily", dailyStatsSchema),
  });
}

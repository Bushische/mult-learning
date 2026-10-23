import { type HeatmapResponse, heatmapResponseSchema } from "@mult/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api-client";

/** Rolling 7-day heatmap of the signed-in child. */
export function useHeatmap() {
  return useQuery({
    queryKey: ["heatmap"],
    refetchInterval: 15_000, // live stat pages: refresh while open
    queryFn: () => api.get<HeatmapResponse>("/stats/heatmap", heatmapResponseSchema),
  });
}

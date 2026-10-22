import { type HeatmapResponse, heatmapResponseSchema } from "@mult/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api-client";

/** Rolling 7-day heatmap of the signed-in child. */
export function useHeatmap() {
  return useQuery({
    queryKey: ["heatmap"],
    queryFn: () => api.get<HeatmapResponse>("/stats/heatmap", heatmapResponseSchema),
  });
}

import { useQuery } from "@tanstack/react-query";
import { type Game, gamesListSchema } from "packages/shared";
import { api } from "../../../lib/api-client";

/** The games assigned to the signed-in child. */
export function useGames() {
  return useQuery({
    queryKey: ["games"],
    queryFn: () => api.get<Game[]>("/games", gamesListSchema),
  });
}

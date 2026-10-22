import { useQuery } from "@tanstack/react-query";
import { type Me, meSchema } from "packages/shared";
import { api } from "../../../lib/api-client";

/** The signed-in profile (username, role, time bank). */
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<Me>("/me", meSchema),
  });
}

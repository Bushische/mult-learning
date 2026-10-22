import { type LoginGridUser, usersListSchema } from "@mult/shared";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api-client";

/** The public login grid (ids + usernames). */
export function useLoginGrid() {
  return useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<LoginGridUser[]>("/users", usersListSchema),
    staleTime: 30_000,
  });
}

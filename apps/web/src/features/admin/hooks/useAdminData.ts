import { useQuery } from "@tanstack/react-query";
import { fetchAdminDaily, fetchAdminGames, fetchAdminUsers, fetchLeaderboard } from "../api";

export function useAdminUsers() {
  return useQuery({ queryKey: ["admin", "users"], queryFn: fetchAdminUsers });
}

export function useAdminGames() {
  return useQuery({ queryKey: ["admin", "games"], queryFn: fetchAdminGames });
}

export function useLeaderboard() {
  return useQuery({ queryKey: ["admin", "leaderboard"], queryFn: fetchLeaderboard });
}

export function useAdminDaily(date?: string) {
  return useQuery({
    queryKey: ["admin", "daily", date ?? "today"],
    queryFn: () => fetchAdminDaily(date),
  });
}

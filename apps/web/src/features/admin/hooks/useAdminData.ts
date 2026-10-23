import { useQuery } from "@tanstack/react-query";
import {
  fetchAdminDaily,
  fetchAdminGames,
  fetchAdminPerGame,
  fetchAdminUserStats,
  fetchAdminUsers,
  fetchLeaderboard,
} from "../api";

export function useAdminUsers() {
  return useQuery({ queryKey: ["admin", "users"], queryFn: fetchAdminUsers });
}

export function useAdminGames() {
  return useQuery({ queryKey: ["admin", "games"], queryFn: fetchAdminGames });
}

export function useLeaderboard() {
  return useQuery({
    queryKey: ["admin", "leaderboard"],
    queryFn: fetchLeaderboard,
    refetchInterval: 15_000, // live stat pages
  });
}

export function useAdminDaily(date?: string) {
  return useQuery({
    queryKey: ["admin", "daily", date ?? "today"],
    queryFn: () => fetchAdminDaily(date),
    refetchInterval: 15_000, // live stat pages
  });
}

export function useAdminUserStats(id: string | undefined) {
  return useQuery({
    queryKey: ["admin", "user-stats", id ?? "unknown"],
    queryFn: () => fetchAdminUserStats(id as string),
    enabled: id !== undefined,
    refetchInterval: 15_000, // live stat pages
  });
}

/** Per-day per-game matrix for one child (T28 tables). */
export function useAdminPerGame(id: string | undefined) {
  return useQuery({
    queryKey: ["admin", "per-game", id ?? "unknown"],
    queryFn: () => fetchAdminPerGame(id as string),
    enabled: id !== undefined,
    refetchInterval: 15_000, // live stat pages
  });
}

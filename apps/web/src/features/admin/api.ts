import {
  type AdminDailyRow,
  type AdminUser,
  type AdminUserStatsResponse,
  type CreateUserRequest,
  type Game,
  type LeaderboardResponse,
  type PerGameDailyQuery,
  type PerGameDailyResponse,
  type UpdateUserRequest,
  adminDailyRowsSchema,
  adminUserSchema,
  adminUserStatsResponseSchema,
  adminUsersListSchema,
  assignGamesRequestSchema,
  createUserRequestSchema,
  gamesListSchema,
  leaderboardResponseSchema,
  perGameDailyResponseSchema,
  updateUserRequestSchema,
} from "@mult/shared";
import { api } from "../../lib/api-client";

export function fetchAdminUsers(): Promise<AdminUser[]> {
  return api.get<AdminUser[]>("/admin/users", adminUsersListSchema);
}

export function fetchAdminGames(): Promise<Game[]> {
  return api.get<Game[]>("/admin/games", gamesListSchema);
}

export function fetchLeaderboard(): Promise<LeaderboardResponse> {
  return api.get<LeaderboardResponse>("/admin/leaderboard", leaderboardResponseSchema);
}

export function fetchAdminDaily(date?: string): Promise<AdminDailyRow[]> {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return api.get<AdminDailyRow[]>(`/admin/stats/daily${query}`, adminDailyRowsSchema);
}

export function createAdminUser(payload: CreateUserRequest): Promise<AdminUser> {
  return api.post<AdminUser>(
    "/admin/users",
    createUserRequestSchema.parse(payload),
    adminUserSchema,
  );
}

export function updateAdminUser(id: string, payload: UpdateUserRequest): Promise<AdminUser> {
  return api.patch<AdminUser>(
    `/admin/users/${id}`,
    updateUserRequestSchema.parse(payload),
    adminUserSchema,
  );
}

export function deleteAdminUser(id: string): Promise<void> {
  return api.delete<void>(`/admin/users/${id}`);
}

export function assignAdminGames(id: string, gameIds: string[]): Promise<string[]> {
  return api.put<string[]>(`/admin/users/${id}/games`, assignGamesRequestSchema.parse({ gameIds }));
}

export function resetAdminUser(id: string): Promise<void> {
  return api.post<void>(`/admin/users/${id}/reset`);
}

export function fetchAdminUserStats(id: string): Promise<AdminUserStatsResponse> {
  return api.get<AdminUserStatsResponse>(`/admin/users/${id}/stats`, adminUserStatsResponseSchema);
}

export function fetchAdminPerGame(id: string, days = 7): Promise<PerGameDailyResponse> {
  const query: PerGameDailyQuery = { days };
  return api.get<PerGameDailyResponse>(
    `/admin/users/${id}/per-game?days=${query.days as number}`,
    perGameDailyResponseSchema,
  );
}

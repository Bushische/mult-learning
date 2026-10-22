import {
  type AdminDailyRow,
  type AdminUser,
  type CreateUserRequest,
  type Game,
  type LeaderboardRow,
  type UpdateUserRequest,
  adminDailyRowsSchema,
  adminUserSchema,
  adminUsersListSchema,
  assignGamesRequestSchema,
  createUserRequestSchema,
  gamesListSchema,
  leaderboardSchema,
  updateUserRequestSchema,
} from "packages/shared";
import { api } from "../../lib/api-client";

export function fetchAdminUsers(): Promise<AdminUser[]> {
  return api.get<AdminUser[]>("/admin/users", adminUsersListSchema);
}

export function fetchAdminGames(): Promise<Game[]> {
  return api.get<Game[]>("/admin/games", gamesListSchema);
}

export function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  return api.get<LeaderboardRow[]>("/admin/leaderboard", leaderboardSchema);
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

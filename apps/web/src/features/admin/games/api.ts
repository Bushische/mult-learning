import {
  type Game,
  type GameConfig,
  type GamePatch,
  gameConfigSchema,
  gamePatchSchema,
  gameSchema,
  gamesListSchema,
} from "@mult/shared";
import { api } from "../../../lib/api-client";

export function fetchAdminGames(): Promise<Game[]> {
  return api.get<Game[]>("/admin/games", gamesListSchema);
}

export function createGame(config: GameConfig): Promise<Game> {
  return api.post<Game>("/admin/games", gameConfigSchema.parse(config), gameSchema);
}

export function updateGame(id: string, patch: GamePatch): Promise<Game> {
  return api.patch<Game>(`/admin/games/${id}`, gamePatchSchema.parse(patch), gameSchema);
}

export function deleteGame(id: string): Promise<void> {
  return api.delete<void>(`/admin/games/${id}`);
}

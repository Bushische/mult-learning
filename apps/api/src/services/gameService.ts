import { type Game, gameSchema } from "@mult/shared";
import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { type GameRow, games, userGameAssignments } from "../db/schema.js";

function parseJsonArray<T>(raw: string | null): T[] | null {
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : null;
  } catch {
    return null;
  }
}

/** Map a `games` row to the wire DTO (JSON columns parsed). */
export function toGameDto(row: GameRow): Game {
  return gameSchema.parse({
    id: row.id,
    name: row.name,
    operations: parseJsonArray<string>(row.operationsJson) ?? ["mul"],
    rangeA: { min: row.rangeAMin, max: row.rangeAMax },
    rangeB: { min: row.rangeBMin, max: row.rangeBMax },
    allowedCombinations: parseJsonArray<[number, number]>(row.allowedCombinationsJson),
    variantCount: row.variantCount,
    baseTimeReward: row.baseTimeReward,
    timePenalty: row.timePenalty,
    maxDailyTime: row.maxDailyTime,
    questionSeconds: row.questionSeconds,
    hints: parseJsonArray<{ factor: number; text: string }>(row.hintsJson) ?? [],
  });
}

/** All games (admins). */
export function listAllGames(db: Db): Game[] {
  return db.select().from(games).all().map(toGameDto);
}

/** Games assigned to one user. */
export function listGamesForUser(db: Db, userId: string): Game[] {
  const rows = db
    .select({ game: games })
    .from(userGameAssignments)
    .innerJoin(games, eq(userGameAssignments.gameId, games.id))
    .where(eq(userGameAssignments.userId, userId))
    .all();
  return rows.map((row) => toGameDto(row.game));
}

/** Games assigned to one user, restricted to a set of ids (admin game picker). */
export function listGamesByIds(db: Db, gameIds: string[]): Game[] {
  if (gameIds.length === 0) return [];
  return db
    .select()
    .from(games)
    .where(and(eq(games.id, gameIds[0] ?? "")))
    .all()
    .filter((row) => gameIds.includes(row.id))
    .map(toGameDto);
}

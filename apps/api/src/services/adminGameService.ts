import type { Game, GameConfig, GamePatch } from "@mult/shared";
import { eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { type GameRow, games } from "../db/schema.js";
import { notFound } from "../errors.js";
import { toGameDto } from "./gameService.js";

/** All games (admin view). */
export function listAdminGames(db: Db): Game[] {
  return db.select().from(games).all().map(toGameDto);
}

export function findGameRow(db: Db, id: string): GameRow {
  const row = db.select().from(games).where(eq(games.id, id)).get();
  if (!row) throw notFound("Game not found");
  return row;
}

/** Create a game (admin). */
export function createGame(db: Db, config: GameConfig): Game {
  const now = new Date();
  const inserted = db
    .insert(games)
    .values({
      name: config.name,
      rangeAMin: config.rangeA.min,
      rangeAMax: config.rangeA.max,
      rangeBMin: config.rangeB.min,
      rangeBMax: config.rangeB.max,
      allowedCombinationsJson: config.allowedCombinations
        ? JSON.stringify(config.allowedCombinations)
        : null,
      variantCount: config.variantCount,
      baseTimeReward: config.baseTimeReward,
      timePenalty: config.timePenalty,
      maxDailyTime: config.maxDailyTime,
      questionSeconds: config.questionSeconds,
      hintsJson: JSON.stringify(config.hints),
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();
  return toGameDto(inserted);
}

/** Patch a game (admin). */
export function updateGame(db: Db, id: string, patch: GamePatch): Game {
  const row = findGameRow(db, id);
  const updates: Partial<typeof games.$inferInsert> = { updatedAt: new Date() };

  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.rangeA !== undefined) {
    updates.rangeAMin = patch.rangeA.min;
    updates.rangeAMax = patch.rangeA.max;
  }
  if (patch.rangeB !== undefined) {
    updates.rangeBMin = patch.rangeB.min;
    updates.rangeBMax = patch.rangeB.max;
  }
  if (patch.allowedCombinations !== undefined) {
    updates.allowedCombinationsJson = patch.allowedCombinations
      ? JSON.stringify(patch.allowedCombinations)
      : null;
  }
  if (patch.variantCount !== undefined) updates.variantCount = patch.variantCount;
  if (patch.baseTimeReward !== undefined) updates.baseTimeReward = patch.baseTimeReward;
  if (patch.timePenalty !== undefined) updates.timePenalty = patch.timePenalty;
  if (patch.maxDailyTime !== undefined) updates.maxDailyTime = patch.maxDailyTime;
  if (patch.questionSeconds !== undefined) updates.questionSeconds = patch.questionSeconds;
  if (patch.hints !== undefined) updates.hintsJson = JSON.stringify(patch.hints);

  const updated = db.update(games).set(updates).where(eq(games.id, row.id)).returning().get();
  return toGameDto(updated);
}

/** Delete a game (admin) — cascades the user assignments. */
export function deleteGame(db: Db, id: string): void {
  const row = findGameRow(db, id);
  db.delete(games).where(eq(games.id, row.id)).run();
}

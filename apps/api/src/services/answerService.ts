import type { AnswerRequest, AnswerResponse } from "@mult/shared";
import { computeRewardSeconds } from "@mult/shared";
import { and, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import {
  dailyStats,
  gameDailyStats,
  games,
  matrixStats,
  userGameAssignments,
  users,
} from "../db/schema.js";
import { forbidden, notFound } from "../errors.js";

/** Today's UTC date (`YYYY-MM-DD`) — the key of the daily stats row. */
export function todayUtc(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Record one answer. Server-side only (docs/API.md — Answers):
 * assignment check → correctness → time delta → bank clamp → stats writes.
 * All writes happen inside a single transaction.
 */
export function submitAnswer(db: Db, userId: string, request: AnswerRequest): AnswerResponse {
  const game = db.select().from(games).where(eq(games.id, request.gameId)).get();
  if (!game) throw notFound("Game not found");

  const assignment = db
    .select()
    .from(userGameAssignments)
    .where(and(eq(userGameAssignments.userId, userId), eq(userGameAssignments.gameId, game.id)))
    .get();
  if (!assignment) throw forbidden("This game is not assigned to you");

  const rightAnswer = request.factorA * request.factorB;
  const correct = request.chosen !== null && request.chosen === rightAnswer;
  const reward = computeRewardSeconds({
    baseTimeReward: game.baseTimeReward,
    questionSeconds: game.questionSeconds,
    elapsedMs: request.elapsedMs,
  });
  const rawDelta = correct ? reward : -game.timePenalty;

  return db.transaction((tx) => {
    const user = tx.select().from(users).where(eq(users.id, userId)).get();
    if (!user) throw notFound("User not found");

    const currentBank = user.timeBankSeconds;
    const newBank = Math.min(Math.max(currentBank + rawDelta, 0), game.maxDailyTime);
    // The delta that actually reached the bank (0 when the bank is at a bound).
    const appliedDelta = newBank - currentBank;

    tx.update(users)
      .set({ timeBankSeconds: newBank, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .run();

    tx.insert(matrixStats)
      .values({
        userId,
        factorA: request.factorA,
        factorB: request.factorB,
        correct,
        timestamp: new Date(),
      })
      .run();

    const date = todayUtc();
    const existing = tx
      .select()
      .from(dailyStats)
      .where(and(eq(dailyStats.userId, userId), eq(dailyStats.date, date)))
      .get();

    const earnedDelta = appliedDelta > 0 ? appliedDelta : 0;
    if (existing) {
      tx.update(dailyStats)
        .set({
          totalTries: existing.totalTries + 1,
          correctTries: existing.correctTries + (correct ? 1 : 0),
          timeEarnedSeconds: existing.timeEarnedSeconds + earnedDelta,
        })
        .where(eq(dailyStats.id, existing.id))
        .run();
    } else {
      tx.insert(dailyStats)
        .values({
          userId,
          date,
          totalTries: 1,
          correctTries: correct ? 1 : 0,
          timeEarnedSeconds: earnedDelta,
        })
        .run();
    }

    const existingPerGame = tx
      .select()
      .from(gameDailyStats)
      .where(
        and(
          eq(gameDailyStats.userId, userId),
          eq(gameDailyStats.gameId, game.id),
          eq(gameDailyStats.date, date),
        ),
      )
      .get();
    if (existingPerGame) {
      tx.update(gameDailyStats)
        .set({
          totalTries: existingPerGame.totalTries + 1,
          correctTries: existingPerGame.correctTries + (correct ? 1 : 0),
          timeEarnedSeconds: existingPerGame.timeEarnedSeconds + earnedDelta,
        })
        .where(eq(gameDailyStats.id, existingPerGame.id))
        .run();
    } else {
      tx.insert(gameDailyStats)
        .values({
          userId,
          gameId: game.id,
          date,
          totalTries: 1,
          correctTries: correct ? 1 : 0,
          timeEarnedSeconds: earnedDelta,
        })
        .run();
    }

    return {
      correct,
      rightAnswer,
      timeBankSeconds: newBank,
      timeDelta: appliedDelta,
    };
  });
}

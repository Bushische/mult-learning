import type { AdminDailyRow, LeaderboardRow, PerGameDailyResponse } from "@mult/shared";
import { and, eq, gte } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { dailyStats, gameDailyStats, users } from "../db/schema.js";
import { notFound } from "../errors.js";
import { getHeatmap } from "./statsService.js";

/** Number of days used by the leaderboard window (today included). */
export const LEADERBOARD_WINDOW_DAYS = 7;

/** `YYYY-MM-DD` of the first day of the window. */
export function windowStartDate(now: Date = new Date()): string {
  const start = new Date(now.getTime() - (LEADERBOARD_WINDOW_DAYS - 1) * 24 * 60 * 60 * 1000);
  return start.toISOString().slice(0, 10);
}

/**
 * Rank users by a set of `daily_stats` rows: earned time desc, username asc.
 * Users without activity show 0 seconds and a null accuracy.
 */
function rankLeaderboard(
  allUsers: { id: string; username: string }[],
  rows: { userId: string; timeEarnedSeconds: number; totalTries: number; correctTries: number }[],
): LeaderboardRow[] {
  return allUsers
    .map((user) => {
      const own = rows.filter((row) => row.userId === user.id);
      const timeEarnedSeconds = own.reduce((sum, row) => sum + row.timeEarnedSeconds, 0);
      const totalTries = own.reduce((sum, row) => sum + row.totalTries, 0);
      const correctTries = own.reduce((sum, row) => sum + row.correctTries, 0);
      const accuracy = totalTries === 0 ? null : correctTries / totalTries;
      return {
        userId: user.id,
        username: user.username,
        timeEarnedSeconds,
        accuracy,
      };
    })
    .sort((a, b) => {
      if (b.timeEarnedSeconds !== a.timeEarnedSeconds) {
        return b.timeEarnedSeconds - a.timeEarnedSeconds;
      }
      return a.username.localeCompare(b.username);
    });
}

/**
 * Leaderboard: 7-day earned time (desc) + 7-day accuracy.
 */
export function getLeaderboard(db: Db, now: Date = new Date()): LeaderboardRow[] {
  const start = windowStartDate(now);
  const rows = db.select().from(dailyStats).where(gte(dailyStats.date, start)).all();
  return rankLeaderboard(db.select().from(users).all(), rows);
}

/** Today's leaderboard: only `daily_stats` rows with `date` = today (UTC). */
export function getLeaderboardToday(db: Db, now: Date = new Date()): LeaderboardRow[] {
  const rows = db
    .select()
    .from(dailyStats)
    .where(eq(dailyStats.date, todayDate(now)))
    .all();
  return rankLeaderboard(db.select().from(users).all(), rows);
}

/** Both leaderboard windows in one payload: today first, last 7 days second. */
export function getLeaderboardWindows(db: Db, now: Date = new Date()) {
  return { today: getLeaderboardToday(db, now), last7Days: getLeaderboard(db, now) };
}

/**
 * One child's stats for the admin page: identity + rolling 7-day heatmap +
 * 7-day totals (`incorrect = attempts − correct`).
 */
export function getAdminUserStats(db: Db, userId: string, now: Date = new Date()) {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) throw notFound("User not found");

  const start = windowStartDate(now);
  const rows = db
    .select()
    .from(dailyStats)
    .where(and(eq(dailyStats.userId, userId), gte(dailyStats.date, start)))
    .all();
  const attempts = rows.reduce((sum, row) => sum + row.totalTries, 0);
  const correct = rows.reduce((sum, row) => sum + row.correctTries, 0);
  return {
    user: { id: user.id, username: user.username, timeBankSeconds: user.timeBankSeconds },
    heatmap: getHeatmap(db, userId, now).cells,
    last7Days: {
      attempts,
      correct,
      incorrect: attempts - correct,
      earnedSeconds: rows.reduce((sum, row) => sum + row.timeEarnedSeconds, 0),
    },
  };
}

/** Daily overview for one day (default: today). */
export function getAdminDailyStats(db: Db, date: string): AdminDailyRow[] {
  const rows = db.select().from(dailyStats).where(eq(dailyStats.date, date)).all();
  return db
    .select()
    .from(users)
    .all()
    .map((user) => {
      const row = rows.find((entry) => entry.userId === user.id);
      return {
        userId: user.id,
        username: user.username,
        totalTries: row?.totalTries ?? 0,
        correctTries: row?.correctTries ?? 0,
        timeEarnedSeconds: row?.timeEarnedSeconds ?? 0,
        timeBankSeconds: user.timeBankSeconds,
      };
    });
}

/** `YYYY-MM-DD` for "today" (UTC). */
export function todayDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * Per-day per-game matrix for one user: the last `days` UTC dates ending today
 * (oldest first), each with the games that have recorded answers that day.
 * Shared by the admin child-stats page and (T30) the child home screen.
 */
export function getPerGameDaily(
  db: Db,
  userId: string,
  days = 7,
  now: Date = new Date(),
): PerGameDailyResponse {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) throw notFound("User not found");

  const dates: string[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(now.getTime() - offset * 24 * 60 * 60 * 1000);
    dates.push(day.toISOString().slice(0, 10));
  }
  const rows = db
    .select()
    .from(gameDailyStats)
    .where(and(eq(gameDailyStats.userId, userId), gte(gameDailyStats.date, dates[0] as string)))
    .all();
  return {
    user: { id: user.id, username: user.username, timeBankSeconds: user.timeBankSeconds },
    days: dates.map((date) => ({
      date,
      games: rows
        .filter((row) => row.date === date)
        .map((row) => ({
          gameId: row.gameId,
          totalTries: row.totalTries,
          correctTries: row.correctTries,
          timeEarnedSeconds: row.timeEarnedSeconds,
        }))
        .sort((a, b) => a.gameId.localeCompare(b.gameId)),
    })),
  };
}

export { and, eq };

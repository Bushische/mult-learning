import type { AdminDailyRow, LeaderboardRow } from "@mult/shared";
import { and, eq, gte } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { dailyStats, users } from "../db/schema.js";

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

export { and, eq };

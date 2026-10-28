import { createId } from "@paralleldrive/cuid2";
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/**
 * Drizzle schema — verbatim from docs/DATA_MODEL.md.
 * Ids are cuid2 text PKs, timestamps are unix epoch, time is integer seconds.
 */

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(createId),
  username: text("username").notNull().unique(),
  pinHash: text("pin_hash").notNull(),
  role: text("role", { enum: ["admin", "user"] })
    .notNull()
    .default("user"),
  timeBankSeconds: integer("time_bank_seconds").notNull().default(0),
  /** Last UTC day (`YYYY-MM-DD`) the bank was touched — a new day starts at 0. */
  bankDate: text("bank_date"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const games = sqliteTable("games", {
  id: text("id").primaryKey().$defaultFn(createId),
  name: text("name").notNull(),
  rangeAMin: integer("range_a_min").notNull(),
  rangeAMax: integer("range_a_max").notNull(),
  rangeBMin: integer("range_b_min").notNull(),
  rangeBMax: integer("range_b_max").notNull(),
  allowedCombinationsJson: text("allowed_combinations_json"),
  variantCount: integer("variant_count").notNull().default(3),
  baseTimeReward: integer("base_time_reward").notNull(),
  timePenalty: integer("time_penalty").notNull(),
  maxDailyTime: integer("max_daily_time").notNull().default(3600),
  questionSeconds: integer("question_seconds").notNull().default(15),
  hintsJson: text("hints_json").notNull().default("[]"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const userGameAssignments = sqliteTable(
  "user_game_assignments",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.userId, table.gameId] })],
);

export const dailyStats = sqliteTable(
  "daily_stats",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    totalTries: integer("total_tries").notNull().default(0),
    correctTries: integer("correct_tries").notNull().default(0),
    timeEarnedSeconds: integer("time_earned_seconds").notNull().default(0),
  },
  (table) => [uniqueIndex("daily_stats_user_date_idx").on(table.userId, table.date)],
);

/**
 * Per-game daily stats (T28): one row per (user, game, day), upserted on each
 * answer in the same transaction as `daily_stats`. Drives the per-game
 * breakdowns on the admin child-stats page and the child home screen.
 */
export const gameDailyStats = sqliteTable(
  "game_daily_stats",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    totalTries: integer("total_tries").notNull().default(0),
    correctTries: integer("correct_tries").notNull().default(0),
    timeEarnedSeconds: integer("time_earned_seconds").notNull().default(0),
  },
  (table) => [
    uniqueIndex("game_daily_stats_user_game_date_idx").on(table.userId, table.gameId, table.date),
  ],
);

/**
 * Rotating refresh tokens. Only the sha256 hash is stored; the raw value lives
 * in the HttpOnly cookie (docs/API.md — the sessions section).
 */
export const refreshTokens = sqliteTable(
  "refresh_tokens",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [index("refresh_tokens_user_idx").on(table.userId)],
);

export const matrixStats = sqliteTable(
  "matrix_stats",
  {
    id: text("id").primaryKey().$defaultFn(createId),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    factorA: integer("factor_a").notNull(),
    factorB: integer("factor_b").notNull(),
    correct: integer("correct", { mode: "boolean" }).notNull(),
    timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
  },
  (table) => [index("matrix_stats_user_timestamp_idx").on(table.userId, table.timestamp)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type GameRow = typeof games.$inferSelect;
export type NewGameRow = typeof games.$inferInsert;
export type DailyStatRow = typeof dailyStats.$inferSelect;
export type GameDailyStatRow = typeof gameDailyStats.$inferSelect;
export type MatrixStatRow = typeof matrixStats.$inferSelect;
export type UserGameAssignmentRow = typeof userGameAssignments.$inferSelect;
export type RefreshTokenRow = typeof refreshTokens.$inferSelect;

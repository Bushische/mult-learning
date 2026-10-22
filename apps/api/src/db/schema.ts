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
export type MatrixStatRow = typeof matrixStats.$inferSelect;
export type UserGameAssignmentRow = typeof userGameAssignments.$inferSelect;

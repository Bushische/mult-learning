/**
 * Shared contracts for the mult-learning API.
 *
 * This module is the single source of truth for every wire shape used by
 * `apps/api` (server) and `apps/web` (client). All schemas are zod schemas so
 * the same definition validates at the boundary and infers the DTO type.
 *
 * Normative contracts: docs/API.md + docs/DATA_MODEL.md.
 */
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Primitives                                                          */
/* ------------------------------------------------------------------ */

/** cuid2 identifier (text PK in SQLite). */
export const idSchema = z.string().min(1).max(64);

export const userRoleSchema = z.enum(["admin", "user"]);
export type UserRole = z.infer<typeof userRoleSchema>;

export const usernameSchema = z.string().trim().min(1).max(32);

/** 4-digit PIN (stored bcrypt-hashed, never in plaintext). */
export const pinSchema = z.string().regex(/^\d{4}$/, "PIN must be exactly 4 digits");

/** Multiplication factor: 1..20 (DATA_MODEL games / matrix_stats). */
export const factorSchema = z.number().int().min(1).max(20);

/** Integer seconds (never negative). */
export const secondsSchema = z.number().int().min(0);

/** Calendar day in UTC, `YYYY-MM-DD`. */
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

/** Login grid entry: id + username only (no role, no bank, no pin). */
export const loginGridUserSchema = z.object({
  id: idSchema,
  username: usernameSchema,
});
export type LoginGridUser = z.infer<typeof loginGridUserSchema>;

/** Session user embedded in auth responses. */
export const sessionUserSchema = z.object({
  id: idSchema,
  username: usernameSchema,
  role: userRoleSchema,
});
export type SessionUser = z.infer<typeof sessionUserSchema>;

/** `GET /me`. */
export const meSchema = sessionUserSchema.extend({
  timeBankSeconds: secondsSchema,
});
export type Me = z.infer<typeof meSchema>;

/** Admin view of a user (includes assigned game ids and creation time). */
export const adminUserSchema = z.object({
  id: idSchema,
  username: usernameSchema,
  role: userRoleSchema,
  timeBankSeconds: secondsSchema,
  games: z.array(idSchema),
  createdAt: z.string().datetime(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

/* ------------------------------------------------------------------ */
/* Games                                                               */
/* ------------------------------------------------------------------ */

export const factorRangeSchema = z
  .object({
    min: factorSchema,
    max: factorSchema,
  })
  .refine((range) => range.min <= range.max, {
    message: "range min must be <= range max",
    path: ["min"],
  });
export type FactorRange = z.infer<typeof factorRangeSchema>;

/** Exact pinned combination `[a, b]`. */
export const combinationSchema = z.tuple([factorSchema, factorSchema]);
export type Combination = z.infer<typeof combinationSchema>;

/** "Magic Rules" hint for one factor. */
export const gameHintSchema = z.object({
  factor: factorSchema,
  text: z.string().trim().min(1).max(200),
});
export type GameHint = z.infer<typeof gameHintSchema>;

/** Full game payload as returned by `GET /games` and the admin game routes. */
export const gameSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(64),
  rangeA: factorRangeSchema,
  rangeB: factorRangeSchema,
  allowedCombinations: z.array(combinationSchema).nullable(),
  variantCount: z.number().int().min(3).max(6),
  baseTimeReward: secondsSchema,
  timePenalty: secondsSchema,
  maxDailyTime: secondsSchema,
  hints: z.array(gameHintSchema),
});
export type Game = z.infer<typeof gameSchema>;

/** Game configuration sent by admins (no id). */
export const gameConfigSchema = z.object({
  name: z.string().trim().min(1).max(64),
  rangeA: factorRangeSchema,
  rangeB: factorRangeSchema,
  allowedCombinations: z.array(combinationSchema).nullable(),
  variantCount: z.number().int().min(3).max(6),
  baseTimeReward: secondsSchema,
  timePenalty: secondsSchema,
  maxDailyTime: secondsSchema,
  hints: z.array(gameHintSchema),
});
export type GameConfig = z.infer<typeof gameConfigSchema>;

/** Partial game configuration for `PATCH /admin/games/:id`. */
export const gamePatchSchema = z
  .object({
    name: gameConfigSchema.shape.name.optional(),
    rangeA: factorRangeSchema.optional(),
    rangeB: factorRangeSchema.optional(),
    allowedCombinations: z.array(combinationSchema).nullable().optional(),
    variantCount: gameConfigSchema.shape.variantCount.optional(),
    baseTimeReward: gameConfigSchema.shape.baseTimeReward.optional(),
    timePenalty: gameConfigSchema.shape.timePenalty.optional(),
    maxDailyTime: gameConfigSchema.shape.maxDailyTime.optional(),
    hints: z.array(gameHintSchema).optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "patch must contain at least one field",
  });
export type GamePatch = z.infer<typeof gamePatchSchema>;

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export const loginRequestSchema = z.object({
  username: usernameSchema,
  pin: pinSchema,
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const loginResponseSchema = z.object({
  accessToken: z.string().min(1),
  user: sessionUserSchema,
});
export type LoginResponse = z.infer<typeof loginResponseSchema>;

export const refreshResponseSchema = z.object({
  accessToken: z.string().min(1),
  user: sessionUserSchema,
});
export type RefreshResponse = z.infer<typeof refreshResponseSchema>;

export const logoutResponseSchema = z.object({
  ok: z.literal(true),
});
export type LogoutResponse = z.infer<typeof logoutResponseSchema>;

/* ------------------------------------------------------------------ */
/* Answers                                                             */
/* ------------------------------------------------------------------ */

export const answerRequestSchema = z.object({
  gameId: idSchema,
  factorA: factorSchema,
  factorB: factorSchema,
  /** `null` = the child ran out of time. */
  chosen: z.number().int().min(0).nullable(),
});
export type AnswerRequest = z.infer<typeof answerRequestSchema>;

export const answerResponseSchema = z.object({
  correct: z.boolean(),
  rightAnswer: z.number().int(),
  timeBankSeconds: secondsSchema,
  timeDelta: z.number().int(),
});
export type AnswerResponse = z.infer<typeof answerResponseSchema>;

/* ------------------------------------------------------------------ */
/* Stats                                                               */
/* ------------------------------------------------------------------ */

export const heatmapColorSchema = z.enum(["none", "green", "mixed", "red"]);
export type HeatmapColor = z.infer<typeof heatmapColorSchema>;

export const heatmapCellSchema = z
  .object({
    a: factorSchema,
    b: factorSchema,
    tries: z.number().int().min(0),
    correct: z.number().int().min(0),
    accuracy: z.number().min(0).max(1).nullable(),
    color: heatmapColorSchema,
  })
  .superRefine((cell, ctx) => {
    if (cell.tries === 0 && cell.accuracy !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["accuracy"],
        message: "accuracy must be null when there are no tries",
      });
    }
    if (cell.tries > 0 && cell.accuracy === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["accuracy"],
        message: "accuracy is required when there are tries",
      });
    }
  });
export type HeatmapCell = z.infer<typeof heatmapCellSchema>;

export const heatmapResponseSchema = z.object({
  cells: z.array(heatmapCellSchema),
});
export type HeatmapResponse = z.infer<typeof heatmapResponseSchema>;

export const dailyStatsSchema = z.object({
  date: dateSchema,
  totalTries: z.number().int().min(0),
  correctTries: z.number().int().min(0),
  timeEarnedSeconds: secondsSchema,
  timeBankSeconds: secondsSchema,
});
export type DailyStats = z.infer<typeof dailyStatsSchema>;

export const leaderboardRowSchema = z.object({
  userId: idSchema,
  username: usernameSchema,
  timeEarnedSeconds: secondsSchema,
  accuracy: z.number().min(0).max(1).nullable(),
});
export type LeaderboardRow = z.infer<typeof leaderboardRowSchema>;

export const adminDailyRowSchema = z.object({
  userId: idSchema,
  username: usernameSchema,
  totalTries: z.number().int().min(0),
  correctTries: z.number().int().min(0),
  timeEarnedSeconds: secondsSchema,
  timeBankSeconds: secondsSchema,
});
export type AdminDailyRow = z.infer<typeof adminDailyRowSchema>;

/* ------------------------------------------------------------------ */
/* Admin                                                               */
/* ------------------------------------------------------------------ */

export const createUserRequestSchema = z.object({
  username: usernameSchema,
  pin: pinSchema,
  role: userRoleSchema.optional(),
});
export type CreateUserRequest = z.infer<typeof createUserRequestSchema>;

export const updateUserRequestSchema = z
  .object({
    username: usernameSchema.optional(),
    pin: pinSchema.optional(),
    role: userRoleSchema.optional(),
  })
  .refine((patch) => Object.keys(patch).length > 0, {
    message: "patch must contain at least one field",
  });
export type UpdateUserRequest = z.infer<typeof updateUserRequestSchema>;

export const assignGamesRequestSchema = z.object({
  gameIds: z.array(idSchema),
});
export type AssignGamesRequest = z.infer<typeof assignGamesRequestSchema>;

export const adminStatsDailyQuerySchema = z.object({
  date: dateSchema.optional(),
});
export type AdminStatsDailyQuery = z.infer<typeof adminStatsDailyQuerySchema>;

/* ------------------------------------------------------------------ */
/* Collections & error envelope                                        */
/* ------------------------------------------------------------------ */

export const usersListSchema = z.array(loginGridUserSchema);
export const gamesListSchema = z.array(gameSchema);
export const adminUsersListSchema = z.array(adminUserSchema);
export const leaderboardSchema = z.array(leaderboardRowSchema);
export const adminDailyRowsSchema = z.array(adminDailyRowSchema);
export const gameIdsListSchema = z.array(idSchema);

export const errorCodeSchema = z.enum([
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;

export const errorResponseSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
  }),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;

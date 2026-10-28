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

/** Arithmetic operation used by a question (`+ − × ÷`). */
export const operationSchema = z.enum(["add", "sub", "mul", "div"]);
export type Operation = z.infer<typeof operationSchema>;

/** Display symbol per operation. */
export const OPERATION_SYMBOLS: Record<Operation, string> = {
  add: "+",
  sub: "−",
  mul: "×",
  div: "÷",
};

/** List of all operations (stable order for the studio picker). */
export const ALL_OPERATIONS: Operation[] = ["add", "sub", "mul", "div"];

/** Apply an operation to two operands (division assumes exact divisions). */
export function applyOp(a: number, b: number, op: Operation): number {
  switch (op) {
    case "add":
      return a + b;
    case "sub":
      return a - b;
    case "mul":
      return a * b;
    case "div":
      return b === 0 ? 0 : a / b;
  }
}

/** "Magic Rules" hint for one factor, optionally scoped to one operation. */
export const gameHintSchema = z.object({
  factor: z.number().int().min(0).max(20),
  operation: operationSchema.optional(),
  text: z.string().trim().min(1).max(200),
});
export type GameHint = z.infer<typeof gameHintSchema>;

/** One shared magic rule: a factor shortcut, optionally scoped to one operation. */
export const magicRuleSchema = z.object({
  factor: z.number().int().min(0).max(20),
  operation: operationSchema.optional(),
  text: z.string().trim().min(1).max(200),
});
export type MagicRule = z.infer<typeof magicRuleSchema>;

/**
 * Starter set of shared magic rules (T32, extended per operation in T46).
 * Each fires when its factor is either side of the question; per-game
 * `hints` extend this list. Factor 0 rules never fire from the generator
 * (operands are 1..20) but match structurally, e.g. `5 + 0`.
 */
export const SHARED_MAGIC_RULES: MagicRule[] = [
  { factor: 0, operation: "add", text: "Plus 0 — adding nothing keeps the number." },
  { factor: 0, operation: "sub", text: "Minus 0 — taking nothing keeps the number." },
  { factor: 0, operation: "mul", text: "Times 0 — the answer is always 0." },
  { factor: 1, operation: "mul", text: "Times 1 — the number stays the same." },
  { factor: 2, operation: "mul", text: "Times 2 — just double it: 7 × 2 = 7 + 7." },
  { factor: 4, operation: "mul", text: "Times 4 — double it, then double again." },
  {
    factor: 5,
    operation: "mul",
    text: "Times 5 — take times 10, then half: 7 × 5 = 70 ÷ 2.",
  },
  {
    factor: 9,
    operation: "mul",
    text: "Times 9 — take times 10, then subtract once: 7 × 9 = 70 − 7.",
  },
  { factor: 10, operation: "mul", text: "Times 10 — just add a 0 at the end!" },
  { factor: 1, operation: "div", text: "Divide by 1 — the number stays the same." },
];

/** Shared rule for `n ÷ n`: any number divided by itself is 1. */
export const SELF_DIVISION_RULE_TEXT = "Same over same — any number divided by itself is 1.";

/** Every rule (shared first, then the game's own) matching this question. */
export function matchingMagicRules(
  factorA: number,
  factorB: number,
  gameHints: GameHint[] = [],
  operation?: Operation,
): MagicRule[] {
  const scopeOk = (rule: { operation?: Operation }): boolean =>
    rule.operation === undefined || operation === undefined || rule.operation === operation;
  const shared = SHARED_MAGIC_RULES.filter(
    (rule) => scopeOk(rule) && (rule.factor === factorA || rule.factor === factorB),
  );
  const selfDivision: MagicRule[] =
    operation === "div" && factorA === factorB
      ? [{ factor: factorA, operation: "div", text: SELF_DIVISION_RULE_TEXT }]
      : [];
  const own = gameHints.filter(
    (rule) => scopeOk(rule) && (rule.factor === factorA || rule.factor === factorB),
  );
  return [...shared, ...selfDivision, ...own];
}

/** One matching rule text, picked with the injected RNG (deterministic in tests). */
export function pickMagicRule(
  factorA: number,
  factorB: number,
  gameHints: GameHint[] = [],
  rng: () => number = Math.random,
  operation?: Operation,
): string | null {
  const matches = matchingMagicRules(factorA, factorB, gameHints, operation);
  if (matches.length === 0) return null;
  return (matches[Math.floor(rng() * matches.length)] as MagicRule).text;
}

/** Full game payload as returned by `GET /games` and the admin game routes. */
export const gameSchema = z.object({
  id: idSchema,
  name: z.string().trim().min(1).max(64),
  /** Operations mixed by this game (at least one; the server fills `["mul"]` for legacy rows). */
  operations: z.array(operationSchema).min(1),
  rangeA: factorRangeSchema,
  rangeB: factorRangeSchema,
  allowedCombinations: z.array(combinationSchema).nullable(),
  variantCount: z.number().int().min(3).max(6),
  baseTimeReward: secondsSchema,
  timePenalty: secondsSchema,
  maxDailyTime: secondsSchema,
  /** Seconds per question (the countdown length); the reward decays over it. */
  questionSeconds: z.number().int().min(5).max(60),
  hints: z.array(gameHintSchema),
});
export type Game = z.infer<typeof gameSchema>;

/** Game configuration sent by admins (no id). */
export const gameConfigSchema = z.object({
  name: z.string().trim().min(1).max(64),
  operations: z.array(operationSchema).min(1).default(["mul"]),
  rangeA: factorRangeSchema,
  rangeB: factorRangeSchema,
  allowedCombinations: z.array(combinationSchema).nullable(),
  variantCount: z.number().int().min(3).max(6),
  baseTimeReward: secondsSchema,
  timePenalty: secondsSchema,
  maxDailyTime: secondsSchema,
  questionSeconds: z.number().int().min(5).max(60).default(15),
  hints: z.array(gameHintSchema),
});
export type GameConfig = z.infer<typeof gameConfigSchema>;

/** Partial game configuration for `PATCH /admin/games/:id`. */
export const gamePatchSchema = z
  .object({
    name: gameConfigSchema.shape.name.optional(),
    operations: z.array(operationSchema).min(1).optional(),
    rangeA: factorRangeSchema.optional(),
    rangeB: factorRangeSchema.optional(),
    allowedCombinations: z.array(combinationSchema).nullable().optional(),
    variantCount: gameConfigSchema.shape.variantCount.optional(),
    baseTimeReward: gameConfigSchema.shape.baseTimeReward.optional(),
    timePenalty: gameConfigSchema.shape.timePenalty.optional(),
    maxDailyTime: gameConfigSchema.shape.maxDailyTime.optional(),
    questionSeconds: z.number().int().min(5).max(60).optional(),
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
  operation: operationSchema.default("mul"),
  factorA: factorSchema,
  factorB: factorSchema,
  /** `null` = the child ran out of time. */
  chosen: z.number().int().min(0).nullable(),
  /** Milliseconds from the countdown start to the tap (clamped server-side). */
  elapsedMs: z.number().int().min(0),
});
export type AnswerRequest = z.infer<typeof answerRequestSchema>;

export const answerResponseSchema = z.object({
  correct: z.boolean(),
  rightAnswer: z.number().int(),
  timeBankSeconds: secondsSchema,
  timeDelta: z.number().int(),
});
export type AnswerResponse = z.infer<typeof answerResponseSchema>;

/** Grace period: a correct answer within the first 3 seconds pays the full reward. */
export const REWARD_GRACE_MS = 3000;

export interface RewardInput {
  baseTimeReward: number;
  questionSeconds: number;
  elapsedMs: number;
  /** A correct answer never pays less than a mistake costs (T41). */
  timePenalty: number;
}

/**
 * Time-decayed reward for a correct answer: full `baseTimeReward` while
 * `elapsedMs` is inside the grace period, then a linear shrink down to a
 * floor of `min(timePenalty, baseTimeReward)` — a slow correct answer still
 * pays at least what a mistake would cost. Clamped to `[floor, baseReward]`,
 * never negative.
 */
export function computeRewardSeconds({
  baseTimeReward,
  questionSeconds,
  elapsedMs,
  timePenalty,
}: RewardInput): number {
  const totalMs = questionSeconds * 1000;
  const elapsed = Math.min(Math.max(elapsedMs, 0), totalMs);
  if (elapsed <= REWARD_GRACE_MS || totalMs <= REWARD_GRACE_MS) return baseTimeReward;
  const floor = Math.min(Math.max(timePenalty, 0), baseTimeReward);
  const reward = Math.round((baseTimeReward * (totalMs - elapsed)) / (totalMs - REWARD_GRACE_MS));
  return Math.min(Math.max(reward, floor), baseTimeReward);
}

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

export const userWeekSummarySchema = z.object({
  attempts: z.number().int().min(0),
  correct: z.number().int().min(0),
  incorrect: z.number().int().min(0),
  earnedSeconds: secondsSchema,
});
export type UserWeekSummary = z.infer<typeof userWeekSummarySchema>;

export const adminUserStatsResponseSchema = z.object({
  user: z.object({
    id: idSchema,
    username: usernameSchema,
    timeBankSeconds: secondsSchema,
  }),
  heatmap: z.array(heatmapCellSchema),
  last7Days: userWeekSummarySchema,
});
export type AdminUserStatsResponse = z.infer<typeof adminUserStatsResponseSchema>;

/** One game's numbers for one day (per-day per-game recording, T28). */
export const perGameDayStatSchema = z.object({
  gameId: idSchema,
  totalTries: z.number().int().min(0),
  correctTries: z.number().int().min(0),
  timeEarnedSeconds: secondsSchema,
  timeLostSeconds: secondsSchema,
});
export type PerGameDayStat = z.infer<typeof perGameDayStatSchema>;

/** One day of numbers: totals across games plus the per-game breakdown. */
export const perGameDailyDaySchema = z.object({
  date: dateSchema,
  totals: z.object({
    totalTries: z.number().int().min(0),
    correctTries: z.number().int().min(0),
    timeEarnedSeconds: secondsSchema,
    timeLostSeconds: secondsSchema,
  }),
  games: z.array(perGameDayStatSchema),
});
export type PerGameDailyDay = z.infer<typeof perGameDailyDaySchema>;

/** Per-day per-game matrix for one user (admin + child views share it). */
export const perGameDailyResponseSchema = z.object({
  user: z.object({
    id: idSchema,
    username: usernameSchema,
    timeBankSeconds: secondsSchema,
  }),
  days: z.array(perGameDailyDaySchema),
});
export type PerGameDailyResponse = z.infer<typeof perGameDailyResponseSchema>;

export const perGameDailyQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(14).optional(),
});
export type PerGameDailyQuery = z.infer<typeof perGameDailyQuerySchema>;

export const dailyStatsSchema = z.object({
  date: dateSchema,
  totalTries: z.number().int().min(0),
  correctTries: z.number().int().min(0),
  timeEarnedSeconds: secondsSchema,
  timeLostSeconds: secondsSchema,
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
  timeLostSeconds: secondsSchema,
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
export const leaderboardResponseSchema = z.object({
  today: z.array(leaderboardRowSchema),
  last7Days: z.array(leaderboardRowSchema),
});
export type LeaderboardResponse = z.infer<typeof leaderboardResponseSchema>;
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

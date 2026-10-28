# Data model

**NORMATIVE Drizzle schema. Agents must follow this verbatim; changes belong to the task that owns them.**

General rules (fixed, stack-level):
- Ids: `text` primary keys (cuid2 via `@paralleldrive/cuid2`).
- Timestamps: `integer({ mode: "timestamp" })` unix epoch (created_at / timestamp columns).
- Booleans: `integer({ mode: "boolean" })`.
- Time = integer **seconds** columns (`*seconds` names).
- `foreign_keys = ON`; all writes happen in the api app; multi-row writes (reset, cascade deletes)
  run inside one `db.transaction`.
- Tests run on in-memory SQLite (`:memory:`) with migrations applied per suite.

## users
| Column | Type | Notes |
|---|---|---|
| id | text PK | cuid2 |
| username | text, UNIQUE | human identity for the login grid |
| pin_hash | text | bcrypt hash of the 4-digit PIN (never store the PIN itself) |
| role | text enum: `admin` \| `user` | admin extra via `requireAdmin` |
| time_bank_seconds | integer, NOT NULL, default 0 | current accumulated screen time (capped per game `maxDailyTime`) |
| bank_date | text `YYYY-MM-DD` (UTC), NULL | last day the bank was touched — a new day starts the bank at 0 (T39) |
| created_at / updated_at | timestamp | epoch |

## games
| Column | Type | Notes |
|---|---|---|
| id | text PK | cuid2 |
| name | text NOT NULL | e.g. "Easy Twos" |
| operations_json | text NOT NULL, default `'["mul"]'` | JSON `["add","sub","mul","div"]` (min 1); legacy rows read as `["mul"]` |
| range_a_min / range_a_max | integer NOT NULL | factor A range, 1..20, min ≤ max |
| range_b_min / range_b_max | integer NOT NULL | factor B range, 1..20, min ≤ max |
| allowed_combinations_json | text NULL | JSON `[[a,b],...]`; NULL = every combination inside the ranges |
| variant_count | integer NOT NULL, default 3 | answer buttons N, 3..6 |
| base_time_reward | integer NOT NULL | seconds added on a correct answer (before time decay) |
| time_penalty | integer NOT NULL | seconds deducted on wrong/timeout |
| max_daily_time | integer NOT NULL, default 3600 | time bank cap (s) |
| question_seconds | integer NOT NULL, default 15 | countdown length per question (s), 5..60 |
| hints_json | text NOT NULL, default `"[]"` | JSON `[{ "factor": 0..20, "operation"?: "add/sub/mul/div", "text": string }, ...]` — "Magic Rules" hints |
| created_at / updated_at | timestamp | epoch |

## user_game_assignments
| Column | Type | Notes |
|---|---|---|
| user_id | text, FK users.id ON DELETE CASCADE | composite PK (user_id, game_id) |
| game_id | text, FK games.id ON DELETE CASCADE | |

## daily_stats
| Column | Type | Notes |
|---|---|---|
| id | text PK | cuid2 |
| user_id | text, FK users.id ON DELETE CASCADE | UNIQUE (user_id, date) |
| date | text `YYYY-MM-DD` (UTC) | upserted on each answer |
| total_tries | integer NOT NULL, default 0 | |
| correct_tries | integer NOT NULL, default 0 | |
| time_earned_seconds | integer NOT NULL, default 0 | only positive deltas accumulate here |
| time_lost_seconds | integer NOT NULL, default 0 | only actually taken seconds accumulate here (0 at an empty bank) |

## game_daily_stats
| Column | Type | Notes |
|---|---|---|
| id | text PK | cuid2 |
| user_id | text, FK users.id ON DELETE CASCADE | UNIQUE (user_id, game_id, date) |
| game_id | text, FK games.id ON DELETE CASCADE | wiped when the game is deleted |
| date | text `YYYY-MM-DD` (UTC) | upserted on each answer, same transaction as `daily_stats` |
| total_tries | integer NOT NULL, default 0 | answers in this game that day |
| correct_tries | integer NOT NULL, default 0 | |
| time_earned_seconds | integer NOT NULL, default 0 | only positive deltas accumulate here |
| time_lost_seconds | integer NOT NULL, default 0 | only actually taken seconds accumulate here |

## matrix_stats
| Column | Type | Notes |
|---|---|---|
| id | text PK | cuid2 |
| user_id | text, FK users.id ON DELETE CASCADE | |
| operation | text NOT NULL, default `'mul'` | `add\|sub\|mul\|div` — rows written before T48 read as `mul` |
| factor_a / factor_b | integer NOT NULL | 1..20 |
| correct | integer (boolean) NOT NULL | `true` only when `chosen === applyOp(a, b, operation)` |
| timestamp | timestamp NOT NULL (epoch) | indexed `(user_id, timestamp)` — drives the rolling 7-day window |

Options pattern for `@paralleldrive/cuid2` ids:
```ts
// apps/api/src/db/schema.ts
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(createId),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
});
```
Copy this pattern verbatim for the project's tables (swap the columns per this file —
`pin_hash`, `time_bank_seconds` etc.).

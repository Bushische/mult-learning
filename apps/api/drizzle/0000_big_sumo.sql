CREATE TABLE `daily_stats` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`total_tries` integer DEFAULT 0 NOT NULL,
	`correct_tries` integer DEFAULT 0 NOT NULL,
	`time_earned_seconds` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `daily_stats_user_date_idx` ON `daily_stats` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `games` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`range_a_min` integer NOT NULL,
	`range_a_max` integer NOT NULL,
	`range_b_min` integer NOT NULL,
	`range_b_max` integer NOT NULL,
	`allowed_combinations_json` text,
	`variant_count` integer DEFAULT 3 NOT NULL,
	`base_time_reward` integer NOT NULL,
	`time_penalty` integer NOT NULL,
	`max_daily_time` integer DEFAULT 3600 NOT NULL,
	`hints_json` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `matrix_stats` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`factor_a` integer NOT NULL,
	`factor_b` integer NOT NULL,
	`correct` integer NOT NULL,
	`timestamp` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `matrix_stats_user_timestamp_idx` ON `matrix_stats` (`user_id`,`timestamp`);--> statement-breakpoint
CREATE TABLE `user_game_assignments` (
	`user_id` text NOT NULL,
	`game_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `game_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`pin_hash` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`time_bank_seconds` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);
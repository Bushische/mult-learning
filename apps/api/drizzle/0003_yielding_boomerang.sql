CREATE TABLE `game_daily_stats` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`game_id` text NOT NULL,
	`date` text NOT NULL,
	`total_tries` integer DEFAULT 0 NOT NULL,
	`correct_tries` integer DEFAULT 0 NOT NULL,
	`time_earned_seconds` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `game_daily_stats_user_game_date_idx` ON `game_daily_stats` (`user_id`,`game_id`,`date`);
PRAGMA foreign_keys=OFF;
--> statement-breakpoint
CREATE TABLE `thread_participants_new` (
	`thread_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`dm_channel_id` text,
	`member_alias` integer,
	`joined_at` integer NOT NULL,
	`last_read_at` integer,
	`deleted_at` integer,
	PRIMARY KEY(`thread_id`, `user_id`, `role`)
);
--> statement-breakpoint
INSERT INTO `thread_participants_new` (
	`thread_id`,
	`user_id`,
	`role`,
	`dm_channel_id`,
	`member_alias`,
	`joined_at`,
	`last_read_at`,
	`deleted_at`
)
SELECT
	`thread_id`,
	`user_id`,
	`role`,
	`dm_channel_id`,
	`member_alias`,
	`joined_at`,
	`last_read_at`,
	`deleted_at`
FROM `thread_participants`;
--> statement-breakpoint
DROP TABLE `thread_participants`;
--> statement-breakpoint
ALTER TABLE `thread_participants_new` RENAME TO `thread_participants`;
--> statement-breakpoint
CREATE INDEX `thread_participants_user_id_idx` ON `thread_participants` (`user_id`);
--> statement-breakpoint
PRAGMA foreign_keys=ON;

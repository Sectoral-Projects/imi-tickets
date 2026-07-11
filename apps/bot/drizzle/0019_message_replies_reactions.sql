ALTER TABLE `messages` ADD `reply_to_message_id` integer REFERENCES `messages`(`id`);
--> statement-breakpoint
CREATE TABLE `message_reactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`emoji_name` text NOT NULL,
	`emoji_id` text,
	`emoji_key` text NOT NULL,
	`is_animated` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `message_reactions_message_user_emoji_idx` ON `message_reactions` (`message_id`,`user_id`,`emoji_key`);

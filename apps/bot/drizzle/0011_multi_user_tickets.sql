ALTER TABLE `thread_participants` ADD `dm_channel_id` text;
--> statement-breakpoint
ALTER TABLE `threads` ADD `hide_member_identities` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
CREATE TABLE `message_relays` (
	`message_id` integer NOT NULL,
	`target_channel_id` text NOT NULL,
	`relay_message_id` text NOT NULL,
	`recipient_user_id` text,
	PRIMARY KEY(`message_id`, `target_channel_id`),
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `thread_participants_user_id_idx` ON `thread_participants` (`user_id`);
--> statement-breakpoint
UPDATE `thread_participants`
SET `dm_channel_id` = (
	SELECT `dm_channel_id` FROM `threads` WHERE `threads`.`id` = `thread_participants`.`thread_id`
)
WHERE `role` = 'user' AND `dm_channel_id` IS NULL;

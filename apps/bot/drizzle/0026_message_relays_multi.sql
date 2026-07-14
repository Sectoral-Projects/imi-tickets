CREATE TABLE `message_relays_new` (
	`message_id` integer NOT NULL,
	`target_channel_id` text NOT NULL,
	`relay_message_id` text NOT NULL,
	`recipient_user_id` text,
	PRIMARY KEY(`message_id`, `target_channel_id`, `relay_message_id`),
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `message_relays_new` (`message_id`, `target_channel_id`, `relay_message_id`, `recipient_user_id`)
SELECT `message_id`, `target_channel_id`, `relay_message_id`, `recipient_user_id` FROM `message_relays`;
--> statement-breakpoint
DROP TABLE `message_relays`;
--> statement-breakpoint
ALTER TABLE `message_relays_new` RENAME TO `message_relays`;

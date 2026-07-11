CREATE TABLE `message_revisions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` integer NOT NULL,
	`revision` integer NOT NULL,
	`content` text NOT NULL,
	`edited_at` integer NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `message_revisions_message_id_revision_idx` ON `message_revisions` (`message_id`,`revision`);

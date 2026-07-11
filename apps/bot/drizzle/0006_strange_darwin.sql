CREATE TABLE `blocked_entities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`blocked_by` text NOT NULL,
	`reason` text,
	`created_at` integer NOT NULL,
	CONSTRAINT "blocked_entities_type_check" CHECK(entity_type IN ('user', 'role'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `blocked_entities_entity_unique` ON `blocked_entities` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE INDEX `blocked_entities_entity_idx` ON `blocked_entities` (`entity_type`,`entity_id`);--> statement-breakpoint
CREATE TABLE `dm_open_buttons` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`template_id` text NOT NULL,
	`optional_tag` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `dm_open_buttons_template_id_idx` ON `dm_open_buttons` (`template_id`);--> statement-breakpoint
CREATE INDEX `dm_open_buttons_sort_order_idx` ON `dm_open_buttons` (`sort_order`);--> statement-breakpoint
CREATE TABLE `pending_ticket_opens` (
	`user_id` text PRIMARY KEY NOT NULL,
	`dm_channel_id` text NOT NULL,
	`first_message_id` text NOT NULL,
	`first_message_content` text NOT NULL,
	`created_at` integer NOT NULL
);

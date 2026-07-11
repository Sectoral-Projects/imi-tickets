ALTER TABLE `config` ADD `channel_panel_enabled` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `config` ADD `channel_panel_channel_id` text;
--> statement-breakpoint
ALTER TABLE `config` ADD `channel_panel_forum_thread_id` text;
--> statement-breakpoint
ALTER TABLE `config` ADD `channel_panel_message_id` text;
--> statement-breakpoint
ALTER TABLE `config` ADD `channel_panel_forum_post_title` text;
--> statement-breakpoint
CREATE TABLE `channel_open_buttons` (
	`id` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`template_id` text NOT NULL,
	`action_type` text DEFAULT 'message' NOT NULL,
	`modal_template_id` text,
	`modal_config` text,
	`optional_tag` text,
	`subject_template` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `channel_open_buttons_template_id_idx` ON `channel_open_buttons` (`template_id`);
--> statement-breakpoint
CREATE INDEX `channel_open_buttons_sort_order_idx` ON `channel_open_buttons` (`sort_order`);

ALTER TABLE `dm_open_buttons` ADD `action_type` text DEFAULT 'message' NOT NULL;
--> statement-breakpoint
ALTER TABLE `dm_open_buttons` ADD `modal_config` text;
--> statement-breakpoint
ALTER TABLE `message_templates` ADD `button_actions` text;

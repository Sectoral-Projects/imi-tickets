ALTER TABLE `dm_open_buttons` ADD `action_type` text DEFAULT 'message' NOT NULL;
ALTER TABLE `dm_open_buttons` ADD `modal_config` text;
ALTER TABLE `message_templates` ADD `button_actions` text;

ALTER TABLE `threads` ADD `dm_channel_id` text;--> statement-breakpoint
UPDATE `threads` SET `dm_channel_id` = `channel_id` WHERE `dm_channel_id` IS NULL AND `channel_id` IS NOT NULL;--> statement-breakpoint
UPDATE `threads` SET `channel_id` = NULL WHERE `dm_channel_id` = `channel_id`;
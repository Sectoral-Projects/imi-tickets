CREATE TABLE `guild_staff_role_permissions` (
	`guild_id` text NOT NULL,
	`role_id` text NOT NULL,
	`permissions` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	PRIMARY KEY(`guild_id`, `role_id`)
);
--> statement-breakpoint
CREATE INDEX `guild_staff_role_permissions_guild_id_idx` ON `guild_staff_role_permissions` (`guild_id`);--> statement-breakpoint
CREATE TABLE `linked_guilds` (
	`guild_id` text PRIMARY KEY NOT NULL,
	`name` text,
	`is_primary` integer DEFAULT false NOT NULL,
	`channel_strategy` text,
	`category_channel_id` text,
	`forum_channel_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_config` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`primary_guild_id` text,
	`log_channel_id` text,
	`transcript_channel_id` text,
	`setup_owner_user_id` text,
	`onboarding_completed_at` integer,
	`settings` text,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_config`("id", "primary_guild_id", "log_channel_id", "transcript_channel_id", "setup_owner_user_id", "onboarding_completed_at", "settings", "created_at", "updated_at") SELECT "id", "primary_guild_id", "log_channel_id", "transcript_channel_id", NULL, NULL, "settings", "created_at", "updated_at" FROM `config`;--> statement-breakpoint
DROP TABLE `config`;--> statement-breakpoint
ALTER TABLE `__new_config` RENAME TO `config`;--> statement-breakpoint
PRAGMA foreign_keys=ON;
CREATE TABLE `attachments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`message_id` integer,
	`note_id` integer,
	`url` text NOT NULL,
	`name` text,
	`is_spoiler` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	CONSTRAINT "attachments_parent_check" CHECK(
				(message_id IS NOT NULL AND note_id IS NULL)
				OR
				(message_id IS NULL AND note_id IS NOT NULL)
			)
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`action` text NOT NULL,
	`thread_id` integer,
	`message_id` text,
	`note_id` integer,
	`user_id` text,
	`executed_by` text NOT NULL,
	`channel_id` text,
	`payload` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `config` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`primary_guild_id` text NOT NULL,
	`log_channel_id` text,
	`transcript_channel_id` text,
	`settings` text,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `member_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`username` text,
	`global_name` text,
	`avatar` text,
	`role_ids` text,
	`highest_role_id` text,
	`nickname` text,
	`captured_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `message_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`template` text NOT NULL,
	`category` text,
	`enabled` integer DEFAULT true NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`thread_id` integer NOT NULL,
	`channel_id` text NOT NULL,
	`author_id` text NOT NULL,
	`message_id` text NOT NULL,
	`member_snapshot_id` integer,
	`content` text NOT NULL,
	`revision` integer DEFAULT 1 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`thread_id` integer NOT NULL,
	`author_id` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `thread_participants` (
	`thread_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`joined_at` integer NOT NULL,
	`last_read_at` integer,
	`deleted_at` integer,
	PRIMARY KEY(`thread_id`, `user_id`)
);
--> statement-breakpoint
CREATE TABLE `thread_status_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`thread_id` integer NOT NULL,
	`status` text NOT NULL,
	`changed_by` text NOT NULL,
	`reason` text,
	`changed_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `thread_tags` (
	`thread_id` integer NOT NULL,
	`tag` text NOT NULL,
	PRIMARY KEY(`thread_id`, `tag`)
);
--> statement-breakpoint
CREATE TABLE `threads` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`channel_id` text,
	`subject` text,
	`last_message_at` integer,
	`created_at` integer NOT NULL,
	`closed_at` integer,
	`deleted_at` integer
);

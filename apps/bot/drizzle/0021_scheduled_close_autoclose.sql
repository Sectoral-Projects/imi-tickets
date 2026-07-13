ALTER TABLE `threads` ADD `scheduled_close_at` integer;
--> statement-breakpoint
ALTER TABLE `threads` ADD `auto_close_disabled` integer DEFAULT false NOT NULL;

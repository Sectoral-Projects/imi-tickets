ALTER TABLE `message_templates` ADD `staff_command` text;
--> statement-breakpoint
CREATE UNIQUE INDEX `message_templates_staff_command_unique` ON `message_templates` (`staff_command`);

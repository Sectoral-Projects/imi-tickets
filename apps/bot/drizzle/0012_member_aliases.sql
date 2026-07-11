ALTER TABLE `thread_participants` ADD `member_alias` integer;
--> statement-breakpoint
UPDATE `thread_participants`
SET `member_alias` = (
	SELECT COUNT(*)
	FROM `thread_participants` AS `tp2`
	WHERE `tp2`.`thread_id` = `thread_participants`.`thread_id`
		AND `tp2`.`rowid` <= `thread_participants`.`rowid`
)
WHERE `member_alias` IS NULL
	AND EXISTS (
		SELECT 1
		FROM `threads`
		WHERE `threads`.`id` = `thread_participants`.`thread_id`
			AND `threads`.`hide_member_identities` = 1
	);

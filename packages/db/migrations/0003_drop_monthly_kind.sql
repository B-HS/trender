-- Drop 'monthly' from reports.kind enum. Existing monthly rows must be removed beforehand.
DELETE FROM `reports` WHERE `kind` = 'monthly';
--> statement-breakpoint
ALTER TABLE `reports` MODIFY COLUMN `kind` enum('daily','weekly') NOT NULL;

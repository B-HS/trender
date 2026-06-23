-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE `articles` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`source_id` bigint NOT NULL,
	`url` varchar(768) NOT NULL,
	`lang` enum('ko','ja','en') NOT NULL,
	`title_original` varchar(512) NOT NULL,
	`content_original` mediumtext,
	`published_at` datetime,
	`fetched_at` timestamp NOT NULL DEFAULT (now()),
	`keywords_extracted_at` timestamp,
	`title_translated_ko` varchar(512),
	`content_translated_ko` mediumtext,
	`translated_at` timestamp,
	CONSTRAINT `articles_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_url` UNIQUE(`url`)
);
--> statement-breakpoint
CREATE TABLE `favorites` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`target_type` enum('article','report') NOT NULL,
	`target_id` bigint NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `favorites_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_user_target` UNIQUE(`user_id`,`target_type`,`target_id`)
);
--> statement-breakpoint
CREATE TABLE `keywords_extracted` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`article_id` bigint NOT NULL,
	`keyword` varchar(191) NOT NULL,
	`score` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `keywords_extracted_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `report_items` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`report_id` bigint NOT NULL,
	`article_id` bigint NOT NULL,
	`rank` int NOT NULL,
	CONSTRAINT `report_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reports` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`kind` enum('daily','weekly') NOT NULL,
	`lang` enum('ko','ja','en') NOT NULL,
	`period_start` date NOT NULL,
	`period_end` date NOT NULL,
	`title` varchar(512) NOT NULL,
	`markdown` mediumtext NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`title_translated_ko` varchar(512),
	`markdown_translated_ko` mediumtext,
	`translated_at` timestamp,
	CONSTRAINT `reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_kind_period_lang` UNIQUE(`kind`,`period_start`,`period_end`,`lang`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` varchar(64) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`expires_at` datetime NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `source_stats` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`source_id` bigint NOT NULL,
	`date` date NOT NULL,
	`hit_count` int NOT NULL DEFAULT 0,
	`adoption_count` int NOT NULL DEFAULT 0,
	CONSTRAINT `source_stats_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_source_date` UNIQUE(`source_id`,`date`)
);
--> statement-breakpoint
CREATE TABLE `sources` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`kind` enum('keyword','web') NOT NULL,
	`value` varchar(512) NOT NULL,
	`stage` enum('candidate','active','demoted') NOT NULL DEFAULT 'candidate',
	`lang` enum('ko','ja','en'),
	`promoted_at` datetime,
	`last_used_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sources_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_kind_value` UNIQUE(`kind`,`value`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`username` varchar(64) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_username` UNIQUE(`username`)
);
--> statement-breakpoint
ALTER TABLE `articles` ADD CONSTRAINT `articles_source_id_sources_id_fk` FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `favorites` ADD CONSTRAINT `favorites_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `keywords_extracted` ADD CONSTRAINT `keywords_extracted_article_id_articles_id_fk` FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `report_items` ADD CONSTRAINT `report_items_article_id_articles_id_fk` FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `report_items` ADD CONSTRAINT `report_items_report_id_reports_id_fk` FOREIGN KEY (`report_id`) REFERENCES `reports`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `source_stats` ADD CONSTRAINT `source_stats_source_id_sources_id_fk` FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_published` ON `articles` (`published_at`);--> statement-breakpoint
CREATE INDEX `idx_source` ON `articles` (`source_id`);--> statement-breakpoint
CREATE INDEX `idx_lang` ON `articles` (`lang`);--> statement-breakpoint
CREATE INDEX `idx_keywords_extracted` ON `articles` (`keywords_extracted_at`);--> statement-breakpoint
CREATE INDEX `idx_lang_published` ON `articles` (`lang`,`published_at`);--> statement-breakpoint
CREATE INDEX `idx_fav_user` ON `favorites` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_article` ON `keywords_extracted` (`article_id`);--> statement-breakpoint
CREATE INDEX `idx_keyword` ON `keywords_extracted` (`keyword`);--> statement-breakpoint
CREATE INDEX `idx_report` ON `report_items` (`report_id`);--> statement-breakpoint
CREATE INDEX `idx_article` ON `report_items` (`article_id`);--> statement-breakpoint
CREATE INDEX `idx_created` ON `reports` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_lang_kind` ON `reports` (`lang`,`kind`);--> statement-breakpoint
CREATE INDEX `idx_session_user` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_date` ON `source_stats` (`date`);--> statement-breakpoint
CREATE INDEX `idx_stage` ON `sources` (`stage`);--> statement-breakpoint
CREATE INDEX `idx_lang` ON `sources` (`lang`);
*/
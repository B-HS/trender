CREATE TABLE `article_views` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`article_id` bigint NOT NULL,
	`viewed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `article_views_id` PRIMARY KEY(`id`),
	CONSTRAINT `uniq_view_user_article` UNIQUE(`user_id`,`article_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_view_user` ON `article_views` (`user_id`);--> statement-breakpoint
ALTER TABLE `article_views` ADD CONSTRAINT `article_views_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `article_views` ADD CONSTRAINT `article_views_article_id_articles_id_fk` FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON DELETE cascade ON UPDATE no action;

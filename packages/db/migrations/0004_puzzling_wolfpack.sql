-- Add Korean translation columns to articles (ja/en originals translated to ko at collection time).
-- NOTE: hand-trimmed. Snapshots 0000-0003 had drifted (migrated on another machine), so drizzle's
-- auto-diff emitted spurious ALTERs for columns that already exist in production. Only the 3 new
-- columns are real here; the 0004 snapshot already reflects the true production schema.
ALTER TABLE `articles` ADD `title_translated_ko` varchar(512);
--> statement-breakpoint
ALTER TABLE `articles` ADD `content_translated_ko` mediumtext;
--> statement-breakpoint
ALTER TABLE `articles` ADD `translated_at` timestamp;

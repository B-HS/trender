ALTER TABLE `reports` ADD `vendor` enum('openai','anthropic','google','meta','naver','kakao');--> statement-breakpoint
ALTER TABLE `sources` ADD `vendor` enum('openai','anthropic','google','meta','naver','kakao');--> statement-breakpoint
CREATE INDEX `idx_vendor_kind` ON `reports` (`vendor`,`kind`);--> statement-breakpoint
CREATE INDEX `idx_vendor` ON `sources` (`vendor`);
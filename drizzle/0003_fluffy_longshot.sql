CREATE TABLE `app_locks` (
	`name` varchar(64) NOT NULL,
	`locked_until` datetime,
	CONSTRAINT `app_locks_name` PRIMARY KEY(`name`)
);

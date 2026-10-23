CREATE TABLE `request_history` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`revision` integer NOT NULL,
	`action` text NOT NULL,
	`status` text NOT NULL,
	`reason` text NOT NULL,
	`message` text NOT NULL,
	`created` text NOT NULL,
	`actor` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `attachments` ADD `revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `revision` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `documents` ADD `version` integer DEFAULT 1 NOT NULL;
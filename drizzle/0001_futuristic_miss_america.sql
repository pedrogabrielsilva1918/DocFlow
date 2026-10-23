CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL,
	`label` text NOT NULL,
	`filename` text NOT NULL,
	`mime` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `documents` ADD `requirements` text DEFAULT '[]' NOT NULL;
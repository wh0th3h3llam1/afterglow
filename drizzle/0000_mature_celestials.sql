CREATE TABLE `approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_version_id` text NOT NULL,
	`session_id` text NOT NULL,
	`turn_id` text NOT NULL,
	`thread_id` text NOT NULL,
	`tool_call_id` text NOT NULL,
	`source_event_id` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`decided_at` text,
	FOREIGN KEY (`draft_version_id`) REFERENCES `draft_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `approvals_tool_call_unique` ON `approvals` (`tool_call_id`);--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`organization` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `conversations` (
	`id` text PRIMARY KEY NOT NULL,
	`raw_notes` text NOT NULL,
	`mode` text NOT NULL,
	`status` text NOT NULL,
	`session_id` text,
	`active_turn_id` text,
	`last_sequence` integer DEFAULT 0 NOT NULL,
	`question` text,
	`question_thread_id` text,
	`question_tool_call_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `deliveries` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_version_id` text NOT NULL,
	`mode` text NOT NULL,
	`status` text NOT NULL,
	`idempotency_key` text NOT NULL,
	`provider_receipt` text,
	`failure_reason` text,
	`created_at` text NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`draft_version_id`) REFERENCES `draft_versions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `deliveries_version_unique` ON `deliveries` (`draft_version_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `deliveries_key_unique` ON `deliveries` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `draft_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`draft_id` text NOT NULL,
	`version_number` integer NOT NULL,
	`recipient_name` text NOT NULL,
	`recipient_email` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`resource_links_json` text DEFAULT '[]' NOT NULL,
	`content_hash` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`draft_id`) REFERENCES `drafts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `draft_versions_number_unique` ON `draft_versions` (`draft_id`,`version_number`);--> statement-breakpoint
CREATE TABLE `drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`contact_id` text,
	`current_version_id` text,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `promises` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`contact_id` text,
	`description` text NOT NULL,
	`resource_link` text,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` text NOT NULL,
	`kept_at` text,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contact_id`) REFERENCES `contacts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `run_events` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`session_id` text NOT NULL,
	`turn_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`event_id` text NOT NULL,
	`type` text NOT NULL,
	`payload_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `run_events_event_unique` ON `run_events` (`event_id`);
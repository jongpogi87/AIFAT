CREATE TABLE IF NOT EXISTS `aors` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`internal_code` text NOT NULL UNIQUE,
	`enabled` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `batches` (
	`id` text PRIMARY KEY NOT NULL,
	`class_designation` text NOT NULL,
	`aor_id` text NOT NULL REFERENCES `aors`(`internal_code`),
	`delivery_mode` text NOT NULL,
	`session` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`venue` text NOT NULL,
	`registration_deadline` text,
	`capacity` integer DEFAULT 25,
	`status` text DEFAULT 'OPEN' NOT NULL,
	`enabled` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `learners` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`full_name` text NOT NULL,
	`rank` text,
	`unit` text,
	`email` text NOT NULL,
	`contact_number` text NOT NULL,
	`service_category` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `learners_email_idx` ON `learners` (`email`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `learners_fullname_idx` ON `learners` (`full_name`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` text NOT NULL,
	`timestamp` integer NOT NULL,
	`metadata` text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `admin_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL UNIQUE,
	`email` text NOT NULL UNIQUE,
	`password_hash` text NOT NULL,
	`salt` text NOT NULL,
	`role` text DEFAULT 'ADMIN' NOT NULL,
	`created_at` integer NOT NULL,
	`last_login_at` integer
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `system_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
-- Ensure registration status columns on registrations table
ALTER TABLE `registrations` ADD `learner_id` integer REFERENCES `learners`(`id`);
--> statement-breakpoint
ALTER TABLE `registrations` ADD `registration_status` text DEFAULT 'CONFIRMED';
--> statement-breakpoint
ALTER TABLE `registrations` ADD `registration_timestamp` integer;
--> statement-breakpoint
ALTER TABLE `registrations` ADD `privacy_acknowledged` integer DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `registrations` ADD `privacy_acknowledged_at` integer;
--> statement-breakpoint
ALTER TABLE `registrations` ADD `attendance_status` text DEFAULT 'PENDING';
--> statement-breakpoint
ALTER TABLE `registrations` ADD `completion_status` text DEFAULT 'INCOMPLETE';
--> statement-breakpoint
ALTER TABLE `registrations` ADD `certification_status` text DEFAULT 'NOT_ISSUED';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `registrations_batch_idx` ON `registrations` (`batch_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `registrations_aor_idx` ON `registrations` (`aor`);

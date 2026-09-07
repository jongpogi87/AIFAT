CREATE TABLE `registrations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reference_number` text NOT NULL,
	`full_name` text NOT NULL,
	`rank` text NOT NULL,
	`unit` text NOT NULL,
	`email` text NOT NULL,
	`contact_number` text NOT NULL,
	`service_category` text NOT NULL,
	`aor` text NOT NULL,
	`batch_id` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `registrations_reference_number_unique` ON `registrations` (`reference_number`);--> statement-breakpoint
CREATE UNIQUE INDEX `registrations_email_batch_unique` ON `registrations` (`email`,`batch_id`);
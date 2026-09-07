-- Migration for TESDA Learners Profile Form (MIS 03-01, ver. 2021)
ALTER TABLE `learners` ADD `last_name` text;
--> statement-breakpoint
ALTER TABLE `learners` ADD `first_name` text;
--> statement-breakpoint
ALTER TABLE `learners` ADD `middle_name` text;
--> statement-breakpoint
ALTER TABLE `learners` ADD `extension_name` text;
--> statement-breakpoint
ALTER TABLE `learners` ADD `street` text;
--> statement-breakpoint
ALTER TABLE `learners` ADD `barangay` text;
--> statement-breakpoint
ALTER TABLE `learners` ADD `district` text;
--> statement-breakpoint
ALTER TABLE `learners` ADD `city_municipality` text;
--> statement-breakpoint
ALTER TABLE `learners` ADD `province` text;
--> statement-breakpoint
ALTER TABLE `learners` ADD `region` text;
--> statement-breakpoint
ALTER TABLE `learners` ADD `nationality` text DEFAULT 'Filipino';
--> statement-breakpoint
ALTER TABLE `learners` ADD `sex` text;
--> statement-breakpoint
ALTER TABLE `learners` ADD `civil_status` text;
--> statement-breakpoint
ALTER TABLE `learners` ADD `employment_status` text;
--> statement-breakpoint
ALTER TABLE `learners` ADD `employment_type` text;
--> statement-breakpoint
ALTER TABLE `learners` ADD `birthdate` text;
--> statement-breakpoint
ALTER TABLE `learners` ADD `age` integer;
--> statement-breakpoint
ALTER TABLE `learners` ADD `birth_city` text;
--> statement-breakpoint
ALTER TABLE `learners` ADD `birth_province` text;
--> statement-breakpoint
ALTER TABLE `learners` ADD `birth_region` text;
--> statement-breakpoint
ALTER TABLE `learners` ADD `educational_attainment` text;
--> statement-breakpoint
ALTER TABLE `learners` ADD `parent_guardian_name` text;
--> statement-breakpoint
ALTER TABLE `learners` ADD `parent_guardian_address` text;
--> statement-breakpoint
ALTER TABLE `learners` ADD `learner_classification` text;
--> statement-breakpoint
ALTER TABLE `learners` ADD `classification_others` text;
--> statement-breakpoint
ALTER TABLE `learners` ADD `is_scholar` integer DEFAULT 0;
--> statement-breakpoint
ALTER TABLE `learners` ADD `scholarship_package` text;
--> statement-breakpoint
ALTER TABLE `learners` ADD `scholarship_package_others` text;
--> statement-breakpoint
ALTER TABLE `learners` ADD `uli_number` text;
--> statement-breakpoint
ALTER TABLE `learners` ADD `entry_date` text;
--> statement-breakpoint
ALTER TABLE `learners` ADD `disability_type` text;
--> statement-breakpoint
ALTER TABLE `learners` ADD `disability_causes` text;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `learners_uli_idx` ON `learners` (`uli_number`);
--> statement-breakpoint
ALTER TABLE `registrations` ADD `course_qualification` text DEFAULT 'Artificial Intelligence Fundamentals and Applications In-House Training (AIFAT)';
--> statement-breakpoint
ALTER TABLE `registrations` ADD `applicant_certified` integer DEFAULT 1;
--> statement-breakpoint
ALTER TABLE `registrations` ADD `applicant_certified_at` integer;

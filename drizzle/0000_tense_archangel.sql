CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`title` text NOT NULL,
	`scenario` text NOT NULL,
	`objectives` text NOT NULL,
	`mode` text NOT NULL,
	`difficulty` text NOT NULL,
	`policy` text NOT NULL,
	`min_phases` integer DEFAULT 3 NOT NULL,
	`reflection_questions` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `activity_materials` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`material_id` text NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `activity_material_unique` ON `activity_materials` (`activity_id`,`material_id`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text NOT NULL,
	`actor_user_id` text NOT NULL,
	`action` text NOT NULL,
	`target_id` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `course_members` (
	`id` text PRIMARY KEY NOT NULL,
	`course_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `member_unique` ON `course_members` (`course_id`,`user_id`);--> statement-breakpoint
CREATE TABLE `courses` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text NOT NULL,
	`lecturer_id` text NOT NULL,
	`code` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`semester` text NOT NULL,
	`policy` text DEFAULT 'Guided Discovery' NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`lecturer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `course_tenant` ON `courses` (`institution_id`,`status`);--> statement-breakpoint
CREATE TABLE `institutions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`owner_id` text NOT NULL,
	`retention_days` integer DEFAULT 30 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `learning_signals` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`message_id` text NOT NULL,
	`concept` text NOT NULL,
	`signal_type` text NOT NULL,
	`confidence` real NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `material_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`material_id` text NOT NULL,
	`institution_id` text NOT NULL,
	`course_id` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`page` integer,
	`content` text NOT NULL,
	`token_count` integer NOT NULL,
	`embedding` text,
	`embedding_model` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`material_id`) REFERENCES `materials`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `chunk_scope` ON `material_chunks` (`institution_id`,`course_id`,`material_id`);--> statement-breakpoint
CREATE TABLE `materials` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text NOT NULL,
	`course_id` text NOT NULL,
	`uploaded_by` text NOT NULL,
	`title` text NOT NULL,
	`object_key` text,
	`mime_type` text NOT NULL,
	`file_size` integer NOT NULL,
	`status` text NOT NULL,
	`visibility` text DEFAULT 'COURSE' NOT NULL,
	`error` text,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `message_citations` (
	`id` text PRIMARY KEY NOT NULL,
	`message_id` text NOT NULL,
	`chunk_id` text NOT NULL,
	`quote_text` text NOT NULL,
	FOREIGN KEY (`message_id`) REFERENCES `messages`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`chunk_id`) REFERENCES `material_chunks`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`request_key` text NOT NULL,
	`phase` text,
	`help_level` integer,
	`structured` text,
	`model_name` text,
	`latency_ms` integer,
	`feedback` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `message_idempotency` ON `messages` (`session_id`,`request_key`,`role`);--> statement-breakpoint
CREATE INDEX `message_session` ON `messages` (`session_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`window_start` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text NOT NULL,
	`course_id` text NOT NULL,
	`activity_id` text NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`mode` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`phase` text DEFAULT 'ORIENT' NOT NULL,
	`help_level` integer DEFAULT 0 NOT NULL,
	`stuck_count` integer DEFAULT 0 NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`visited` text NOT NULL,
	`reasoning_map` text NOT NULL,
	`summary` text,
	`note` text DEFAULT '' NOT NULL,
	`share_with_lecturer` integer DEFAULT false NOT NULL,
	`lock_key` text,
	`lock_until` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`completed_at` text,
	`deleted_at` text,
	FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `session_owner` ON `sessions` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `session_course` ON `sessions` (`course_id`,`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`institution_id` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`institution_id`) REFERENCES `institutions`(`id`) ON UPDATE no action ON DELETE no action
);

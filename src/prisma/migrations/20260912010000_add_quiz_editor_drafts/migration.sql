CREATE TABLE `quiz_editor_drafts` (
  `teacher_id` INTEGER NOT NULL,
  `editor_key` VARCHAR(32) NOT NULL,
  `payload` JSON NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`teacher_id`, `editor_key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

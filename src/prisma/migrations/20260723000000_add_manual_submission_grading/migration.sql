-- Keep existing submitted attempts available to teachers for review without exposing scores.
ALTER TABLE `submissions`
  ADD COLUMN `auto_score` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `manual_score` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `status` ENUM('IN_PROGRESS', 'SUBMITTED', 'IN_REVIEW', 'GRADED', 'RELEASED') NOT NULL DEFAULT 'IN_PROGRESS',
  ADD COLUMN `completed_at` TIMESTAMP(0) NULL,
  ADD COLUMN `reviewed_by` INTEGER NULL,
  ADD COLUMN `reviewed_at` TIMESTAMP(0) NULL,
  ADD COLUMN `released_at` TIMESTAMP(0) NULL,
  ADD COLUMN `feedback` TEXT NULL;

ALTER TABLE `submission_answers`
  ADD COLUMN `teacher_points_awarded` INTEGER NULL,
  ADD COLUMN `teacher_feedback` TEXT NULL;

UPDATE `submissions`
SET `auto_score` = COALESCE(`total_score`, 0),
    `status` = 'SUBMITTED',
    `total_score` = NULL;

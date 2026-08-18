-- Preserve the deadline previously stored in time_limit, then repurpose
-- time_limit as an optional duration in minutes.
UPDATE `quizzes` SET `end_date` = `time_limit`;

ALTER TABLE `quizzes` MODIFY `end_date` TIMESTAMP(0) NOT NULL;
ALTER TABLE `quizzes` MODIFY `time_limit` TIMESTAMP(0) NULL;
UPDATE `quizzes` SET `time_limit` = NULL;
ALTER TABLE `quizzes` MODIFY `time_limit` INTEGER NULL;

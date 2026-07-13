/*
  Warnings:

  - The values [True_False,Short_Question,Long_Question] on the enum `Question_question_type` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `Question` MODIFY `question_type` ENUM('MCQ', 'TRUE_FALSE', 'SHORT_Q', 'LONG_Q') NOT NULL;

-- CreateTable
CREATE TABLE `Submission` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_id` INTEGER NOT NULL,
    `quiz_id` INTEGER NOT NULL,
    `total_score` INTEGER NULL,
    `submitted_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `Submission_student_id_idx`(`student_id`),
    INDEX `Submission_quiz_id_idx`(`quiz_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `SubmissionAnswer` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `submission_id` INTEGER NOT NULL,
    `question_id` INTEGER NOT NULL,
    `student_answer` VARCHAR(191) NULL,
    `is_correct` BOOLEAN NULL,
    `points_awarded` INTEGER NULL,

    INDEX `SubmissionAnswer_submission_id_idx`(`submission_id`),
    INDEX `SubmissionAnswer_question_id_idx`(`question_id`),
    UNIQUE INDEX `SubmissionAnswer_submission_id_question_id_key`(`submission_id`, `question_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BehaviorLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `submission_answer_id` INTEGER NOT NULL,
    `event_type` ENUM('TAB_SWITCH', 'COPY_ATTEMPT', 'PASTE_ATTEMPT', 'RAPID_ANSWER_CHANGE', 'FULLSCREEN_EXIT', 'TIME_SPENT_PER_Q') NOT NULL,
    `timestamp` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `metadata` JSON NULL,

    INDEX `BehaviorLog_submission_answer_id_idx`(`submission_answer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Submission` ADD CONSTRAINT `Submission_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Submission` ADD CONSTRAINT `Submission_quiz_id_fkey` FOREIGN KEY (`quiz_id`) REFERENCES `Quiz`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubmissionAnswer` ADD CONSTRAINT `SubmissionAnswer_submission_id_fkey` FOREIGN KEY (`submission_id`) REFERENCES `Submission`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SubmissionAnswer` ADD CONSTRAINT `SubmissionAnswer_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `Question`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BehaviorLog` ADD CONSTRAINT `BehaviorLog_submission_answer_id_fkey` FOREIGN KEY (`submission_answer_id`) REFERENCES `SubmissionAnswer`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

/*
  Warnings:

  - You are about to drop the `BehaviorLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Course` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Enrollment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Question` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `QuestionOption` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Quiz` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Submission` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SubmissionAnswer` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `BehaviorLog` DROP FOREIGN KEY `BehaviorLog_submission_answer_id_fkey`;

-- DropForeignKey
ALTER TABLE `Course` DROP FOREIGN KEY `Course_teacher_id_fkey`;

-- DropForeignKey
ALTER TABLE `Enrollment` DROP FOREIGN KEY `Enrollment_course_id_fkey`;

-- DropForeignKey
ALTER TABLE `Enrollment` DROP FOREIGN KEY `Enrollment_student_id_fkey`;

-- DropForeignKey
ALTER TABLE `Question` DROP FOREIGN KEY `Question_quiz_id_fkey`;

-- DropForeignKey
ALTER TABLE `QuestionOption` DROP FOREIGN KEY `QuestionOption_question_id_fkey`;

-- DropForeignKey
ALTER TABLE `Quiz` DROP FOREIGN KEY `Quiz_course_id_fkey`;

-- DropForeignKey
ALTER TABLE `Submission` DROP FOREIGN KEY `Submission_quiz_id_fkey`;

-- DropForeignKey
ALTER TABLE `Submission` DROP FOREIGN KEY `Submission_student_id_fkey`;

-- DropForeignKey
ALTER TABLE `SubmissionAnswer` DROP FOREIGN KEY `SubmissionAnswer_question_id_fkey`;

-- DropForeignKey
ALTER TABLE `SubmissionAnswer` DROP FOREIGN KEY `SubmissionAnswer_submission_id_fkey`;

-- DropTable
DROP TABLE `BehaviorLog`;

-- DropTable
DROP TABLE `Course`;

-- DropTable
DROP TABLE `Enrollment`;

-- DropTable
DROP TABLE `Question`;

-- DropTable
DROP TABLE `QuestionOption`;

-- DropTable
DROP TABLE `Quiz`;

-- DropTable
DROP TABLE `Submission`;

-- DropTable
DROP TABLE `SubmissionAnswer`;

-- CreateTable
CREATE TABLE `courses` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `teacher_id` INTEGER NOT NULL,

    UNIQUE INDEX `courses_code_key`(`code`),
    INDEX `courses_teacher_id_idx`(`teacher_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `enrollments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_id` INTEGER NOT NULL,
    `course_id` INTEGER NOT NULL,

    INDEX `enrollments_student_id_idx`(`student_id`),
    INDEX `enrollments_course_id_idx`(`course_id`),
    UNIQUE INDEX `enrollments_student_id_course_id_key`(`student_id`, `course_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quizzes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `time_limit` TIMESTAMP(0) NOT NULL,
    `course_id` INTEGER NOT NULL,
    `allowed_attempts` INTEGER NOT NULL DEFAULT 1,
    `status` ENUM('DRAFT', 'PUBLISHED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `quizzes_course_id_idx`(`course_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `questions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quiz_id` INTEGER NOT NULL,
    `question_type` ENUM('MCQ', 'TRUE_FALSE', 'SHORT_Q', 'LONG_Q') NOT NULL,
    `question_text` VARCHAR(191) NOT NULL,
    `correct_answer` VARCHAR(191) NULL,
    `points` INTEGER NULL,
    `question_order` INTEGER NOT NULL,

    INDEX `questions_quiz_id_idx`(`quiz_id`),
    UNIQUE INDEX `questions_quiz_id_question_order_key`(`quiz_id`, `question_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `question_options` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `question_id` INTEGER NOT NULL,
    `option_text` VARCHAR(191) NOT NULL,
    `is_correct` BOOLEAN NOT NULL,
    `option_order` INTEGER NOT NULL,

    INDEX `question_options_question_id_idx`(`question_id`),
    UNIQUE INDEX `question_options_question_id_option_order_key`(`question_id`, `option_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `submissions` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `student_id` INTEGER NOT NULL,
    `quiz_id` INTEGER NOT NULL,
    `total_score` INTEGER NULL,
    `submitted_at` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `submissions_student_id_idx`(`student_id`),
    INDEX `submissions_quiz_id_idx`(`quiz_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `submission_answers` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `submission_id` INTEGER NOT NULL,
    `question_id` INTEGER NOT NULL,
    `student_answer` VARCHAR(191) NULL,
    `is_correct` BOOLEAN NULL,
    `points_awarded` INTEGER NULL,

    INDEX `submission_answers_submission_id_idx`(`submission_id`),
    INDEX `submission_answers_question_id_idx`(`question_id`),
    UNIQUE INDEX `submission_answers_submission_id_question_id_key`(`submission_id`, `question_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `behaviour_logs` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `submission_answer_id` INTEGER NOT NULL,
    `event_type` ENUM('TAB_SWITCH', 'COPY_ATTEMPT', 'PASTE_ATTEMPT', 'RAPID_ANSWER_CHANGE', 'FULLSCREEN_EXIT', 'TIME_SPENT_PER_Q') NOT NULL,
    `timestamp` TIMESTAMP(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `metadata` JSON NULL,

    INDEX `behaviour_logs_submission_answer_id_idx`(`submission_answer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `courses` ADD CONSTRAINT `courses_teacher_id_fkey` FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `enrollments` ADD CONSTRAINT `enrollments_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quizzes` ADD CONSTRAINT `quizzes_course_id_fkey` FOREIGN KEY (`course_id`) REFERENCES `courses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `questions` ADD CONSTRAINT `questions_quiz_id_fkey` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `question_options` ADD CONSTRAINT `question_options_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submissions` ADD CONSTRAINT `submissions_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submissions` ADD CONSTRAINT `submissions_quiz_id_fkey` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submission_answers` ADD CONSTRAINT `submission_answers_submission_id_fkey` FOREIGN KEY (`submission_id`) REFERENCES `submissions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `submission_answers` ADD CONSTRAINT `submission_answers_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `questions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `behaviour_logs` ADD CONSTRAINT `behaviour_logs_submission_answer_id_fkey` FOREIGN KEY (`submission_answer_id`) REFERENCES `submission_answers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

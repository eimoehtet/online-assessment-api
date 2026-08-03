/*
  Warnings:

  - You are about to drop the `QuizAttendance` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `QuizAttendance` DROP FOREIGN KEY `QuizAttendance_enrollment_id_fkey`;

-- DropForeignKey
ALTER TABLE `QuizAttendance` DROP FOREIGN KEY `QuizAttendance_quiz_id_fkey`;

-- DropForeignKey
ALTER TABLE `QuizAttendance` DROP FOREIGN KEY `QuizAttendance_student_id_fkey`;

-- DropTable
DROP TABLE `QuizAttendance`;

-- CreateTable
CREATE TABLE `quiz_attendances` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quiz_id` INTEGER NOT NULL,
    `student_id` INTEGER NOT NULL,
    `enrollment_id` INTEGER NOT NULL,
    `status` BOOLEAN NOT NULL DEFAULT true,
    `marked_by` INTEGER NULL,

    UNIQUE INDEX `quiz_attendances_quiz_id_student_id_key`(`quiz_id`, `student_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `quiz_attendances` ADD CONSTRAINT `quiz_attendances_quiz_id_fkey` FOREIGN KEY (`quiz_id`) REFERENCES `quizzes`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quiz_attendances` ADD CONSTRAINT `quiz_attendances_student_id_fkey` FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `quiz_attendances` ADD CONSTRAINT `quiz_attendances_enrollment_id_fkey` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

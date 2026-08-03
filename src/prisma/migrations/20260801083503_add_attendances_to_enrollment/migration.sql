/*
  Warnings:

  - Added the required column `enrollment_id` to the `QuizAttendance` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `QuizAttendance` ADD COLUMN `enrollment_id` INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE `QuizAttendance` ADD CONSTRAINT `QuizAttendance_enrollment_id_fkey` FOREIGN KEY (`enrollment_id`) REFERENCES `enrollments`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

/*
  Warnings:

  - You are about to drop the column `attendance` on the `QuizAttendance` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `QuizAttendance` DROP COLUMN `attendance`,
    ADD COLUMN `status` BOOLEAN NOT NULL DEFAULT true;

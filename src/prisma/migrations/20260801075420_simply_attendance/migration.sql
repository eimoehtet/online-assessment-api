/*
  Warnings:

  - You are about to alter the column `attendance` on the `QuizAttendance` table. The data in that column could be lost. The data in that column will be cast from `Enum(EnumId(2))` to `TinyInt`.

*/
-- AlterTable
ALTER TABLE `QuizAttendance` MODIFY `attendance` BOOLEAN NOT NULL DEFAULT true;

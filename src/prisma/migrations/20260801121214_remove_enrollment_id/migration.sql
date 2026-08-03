/*
  Warnings:

  - You are about to drop the column `enrollment_id` on the `quiz_attendances` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `quiz_attendances` DROP FOREIGN KEY `quiz_attendances_enrollment_id_fkey`;

-- DropIndex
DROP INDEX `quiz_attendances_enrollment_id_fkey` ON `quiz_attendances`;

-- AlterTable
ALTER TABLE `quiz_attendances` DROP COLUMN `enrollment_id`;

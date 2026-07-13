/*
  Warnings:

  - Added the required column `code` to the `Course` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Course` ADD COLUMN `code` VARCHAR(191) NOT NULL;

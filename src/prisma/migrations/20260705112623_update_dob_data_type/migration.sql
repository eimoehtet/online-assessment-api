/*
  Warnings:

  - You are about to alter the column `date_of_birth` on the `users` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `Date`.

*/
-- AlterTable
ALTER TABLE `users` MODIFY `date_of_birth` DATE NOT NULL;

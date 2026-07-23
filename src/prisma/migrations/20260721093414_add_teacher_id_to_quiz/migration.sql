/*
  Warnings:

  - Added the required column `teacher_id` to the `quizzes` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `quizzes` ADD COLUMN `teacher_id` INTEGER NOT NULL;

-- CreateIndex
CREATE INDEX `quizzes_teacher_id_idx` ON `quizzes`(`teacher_id`);

-- AddForeignKey
ALTER TABLE `quizzes` ADD CONSTRAINT `quizzes_teacher_id_fkey` FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

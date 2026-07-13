/*
  Warnings:

  - A unique constraint covering the columns `[student_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX `users_student_id_key` ON `users`(`student_id`);

/*
  Warnings:

  - A unique constraint covering the columns `[phone_number]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateTable
CREATE TABLE `Course` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `teacher_id` INTEGER NOT NULL,

    INDEX `Course_teacher_id_idx`(`teacher_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `users_phone_number_key` ON `users`(`phone_number`);

-- AddForeignKey
ALTER TABLE `Course` ADD CONSTRAINT `Course_teacher_id_fkey` FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `gender` ENUM('MALE', 'FEMALE') NULL,
    ADD COLUMN `khmer_name` VARCHAR(191) NULL,
    ADD COLUMN `major` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `reset_password_expires` TIMESTAMP(0) NULL,
    ADD COLUMN `reset_password_token` VARCHAR(191) NULL;

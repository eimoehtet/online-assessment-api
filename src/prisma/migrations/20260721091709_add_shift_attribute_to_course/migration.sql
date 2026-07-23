-- DropIndex
DROP INDEX `courses_code_key` ON `courses`;

-- AlterTable
ALTER TABLE `courses` ADD COLUMN `shift` ENUM('MORNING', 'AFTERNOON', 'EVENING') NOT NULL DEFAULT 'MORNING';

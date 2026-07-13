-- CreateTable
CREATE TABLE `Question` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `quiz_id` INTEGER NOT NULL,
    `question_type` ENUM('MCQ', 'True_False', 'Short_Question', 'Long_Question') NOT NULL,
    `question_text` VARCHAR(191) NOT NULL,
    `correct_answer` VARCHAR(191) NULL,
    `points` INTEGER NULL,
    `question_order` INTEGER NOT NULL,

    INDEX `Question_quiz_id_idx`(`quiz_id`),
    UNIQUE INDEX `Question_quiz_id_question_order_key`(`quiz_id`, `question_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuestionOption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `question_id` INTEGER NOT NULL,
    `option_text` VARCHAR(191) NOT NULL,
    `is_correct` BOOLEAN NOT NULL,
    `option_order` INTEGER NOT NULL,

    INDEX `QuestionOption_question_id_idx`(`question_id`),
    UNIQUE INDEX `QuestionOption_question_id_option_order_key`(`question_id`, `option_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Question` ADD CONSTRAINT `Question_quiz_id_fkey` FOREIGN KEY (`quiz_id`) REFERENCES `Quiz`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuestionOption` ADD CONSTRAINT `QuestionOption_question_id_fkey` FOREIGN KEY (`question_id`) REFERENCES `Question`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

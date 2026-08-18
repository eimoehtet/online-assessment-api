CREATE INDEX `quizzes_status_course_id_idx` ON `quizzes`(`status`, `course_id`);
CREATE INDEX `quizzes_teacher_id_status_idx` ON `quizzes`(`teacher_id`, `status`);
CREATE INDEX `submissions_quiz_id_student_id_idx` ON `submissions`(`quiz_id`, `student_id`);

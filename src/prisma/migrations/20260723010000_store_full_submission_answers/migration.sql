-- Written responses can exceed the default VARCHAR(191) Prisma mapping.
ALTER TABLE `submission_answers`
  MODIFY `student_answer` TEXT NULL;

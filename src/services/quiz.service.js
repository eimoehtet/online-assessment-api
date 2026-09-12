const prisma = require("../config/prisma");

const publicInclude = {
  course: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  teacher: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
};

const createQuiz = async (data) => {
  return prisma.quiz.create({
    data,
    include: publicInclude,
  });
};

const listQuizzes = async ({ skip, take, course_id }) => {
  const where = course_id ? { course_id } : undefined;

  const [items, total] = await Promise.all([
    prisma.quiz.findMany({
      where,
      skip,
      take,
      orderBy: { id: "asc" },
      include: publicInclude,
    }),
    prisma.quiz.count({ where }),
  ]);

  return { items, total };
};

const getQuizzesByTeacherId = async (teacherId, { skip, take }) => {
  const [items, total] = await Promise.all([
    prisma.quiz.findMany({
      where: { teacher_id: teacherId },
      skip,
      take,
      orderBy: { id: "asc" },
      include: publicInclude,
    }),
    prisma.quiz.count({ where: { teacher_id: teacherId } }),
  ]);

  return { items, total };
};

const getQuizById = async (id) => {
  return prisma.quiz.findUnique({
    where: { id },
    include: publicInclude,
  });
};

const updateQuizById = async (id, data) => {
  return prisma.quiz.update({
    where: { id },
    data,
    include: publicInclude,
  });
};

const deleteQuizById = async (id) => {
  return prisma.quiz.delete({
    where: { id },
  });
};

const questionInclude = {
  options: {
    orderBy: { option_order: "asc" },
  },
};

const createQuestion = async ({ quiz_id, data, options }) => {
  return prisma.question.create({
    data: {
      ...data,
      quiz_id,
      options: options?.length
        ? {
            create: options,
          }
        : undefined,
    },
    include: questionInclude,
  });
};

const listQuestionsByQuizId = async (quiz_id) => {
  return prisma.question.findMany({
    where: { quiz_id },
    orderBy: { question_order: "asc" },
    include: questionInclude,
  });
};

const getQuestionById = async (id) => {
  return prisma.question.findUnique({
    where: { id },
    include: questionInclude,
  });
};

const updateQuestionById = async ({ id, data, options }) => {
  return prisma.$transaction(async (tx) => {
    await tx.question.update({
      where: { id },
      data,
    });

    if (options) {
      await tx.questionOption.deleteMany({
        where: { question_id: id },
      });

      if (options.length > 0) {
        await tx.questionOption.createMany({
          data: options.map((option) => ({
            ...option,
            question_id: id,
          })),
        });
      }
    }

    return tx.question.findUnique({
      where: { id },
      include: questionInclude,
    });
  });
};

const deleteQuestionById = async (id) => {
  return prisma.question.delete({
    where: { id },
  });
};

const getStudentsByQuizIdAndTeacherId = async (quizId, teacherId, { skip, take } = {}) => {
  const quiz = await prisma.quiz.findFirst({
    where: { id: quizId, teacher_id: teacherId },
    select: { course_id: true },
  });

  if (!quiz) {
    throw new Error("Course not found for the given quizId and teacherId.");
  }

  const where = { course_id: quiz.course_id };
  const [items, total] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      skip,
      take,
      orderBy: { id: "asc" },
      select: {
        id: true,
        course_id: true,
        student_id: true,
        shift: true,
        student: {
          select: {
            id: true, name: true, email: true, student_id: true,
            gender: true, major: true, status: true,
          },
        },
      },
    }),
    prisma.enrollment.count({ where }),
  ]);

  return { items, total };
};

const getAllQuizzesReportByAdmin = async ({ skip, take } = {}) => {
  const [quizzes, total] = await Promise.all([
    prisma.quiz.findMany({
      skip,
      take,
      orderBy: { id: "desc" },
      include: {
      teacher: {
        select: {
          name: true,
        },
      },
      course: {
        select: {
          id: true,
          name: true,
          shift: true,
        },
      },
      },
    }),
    prisma.quiz.count(),
  ]);

  if (quizzes.length === 0) return { items: [], total };

  const courseIds = [...new Set(quizzes.map((quiz) => quiz.course_id))];
  const quizIds = quizzes.map((quiz) => quiz.id);

  const [enrollmentCounts, uniqueAttendees] = await Promise.all([
    prisma.enrollment.groupBy({ by: ["course_id"], where: { course_id: { in: courseIds } }, _count: { _all: true } }),
    prisma.submission.groupBy({ by: ["quiz_id", "student_id"], where: { quiz_id: { in: quizIds } } }),
  ]);
  const enrollmentsByCourseId = new Map(enrollmentCounts.map((row) => [row.course_id, row._count._all]));
  const attendeesByQuizId = uniqueAttendees.reduce((counts, row) => {
    counts.set(row.quiz_id, (counts.get(row.quiz_id) || 0) + 1);
    return counts;
  }, new Map());

  const reports = quizzes.map((quiz) => {
    const numberOfStudents = enrollmentsByCourseId.get(quiz.course.id) || 0;
    const attendees = attendeesByQuizId.get(quiz.id) || 0;
    const absences = Math.max(numberOfStudents - attendees, 0);

    return {
      quiz_id: quiz.id,
      quiz_title: quiz.title,
      course_name: quiz.course.name,
      teacher_name: quiz.teacher.name,
      shift: quiz.course.shift,
      number_of_students: numberOfStudents,
      attendees,
      absences,
    };
  });

  return { items: reports, total };
};

module.exports = {
  createQuiz,
  listQuizzes,
  getQuizById,
  updateQuizById,
  deleteQuizById,
  createQuestion,
  listQuestionsByQuizId,
  getQuestionById,
  updateQuestionById,
  deleteQuestionById,
  getQuizzesByTeacherId,
  getStudentsByQuizIdAndTeacherId,
  getAllQuizzesReportByAdmin,
};

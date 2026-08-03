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

const getStudentsByQuizIdAndTeacherId = async (quizId, teacherId) => {
  // find the course_id from the quizId and teacherId
  const course = await prisma.course.findFirst({
    where: {
      quizzes: {
        some: {
          id: parseInt(quizId, 10),
          teacher_id: parseInt(teacherId, 10),
        },
      }
    },
  });

  if (!course) {
    throw new Error("Course not found for the given quizId and teacherId.");
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { course_id: course.id },
    include: {
      student: true,
    },
  });

  return enrollments;
};

const getAllQuizzesReportByAdmin = async ({ skip, take } = {}) => {
  const quizzes = await prisma.quiz.findMany({
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
  });

  const enrollments = await prisma.enrollment.findMany({
    where: {
      course_id: {
        in: quizzes.map((quiz) => quiz.course.id),
      },
    },
  });

  const submissions = await prisma.submission.findMany({
    where: {
      quiz_id: {
        in: quizzes.map((quiz) => quiz.id),
      },
    },
    select: {
      quiz_id: true,
      student_id: true,
    },
  });

  // Map enrollments by course_id for quick lookup
  const enrollmentsByCourseId = enrollments.reduce((acc, enrollment) => {
    if (!acc[enrollment.course_id]) {
      acc[enrollment.course_id] = [];
    }
    acc[enrollment.course_id].push(enrollment.student);
    return acc;
  }, {});

  // Map submissions by quiz_id for quick lookup
  const submissionsByQuizId = submissions.reduce((acc, submission) => {
    if (!acc[submission.quiz_id]) {
      acc[submission.quiz_id] = [];
    }
    acc[submission.quiz_id].push(submission);
    return acc;
  }, {});

  const reports = quizzes.map((quiz) => {
    const key = `${quiz.course.id}-${quiz.teacher_id}-${quiz.course.shift}`;

    const numberOfStudents = enrollmentsByCourseId[quiz.course.id]?.length || 0;

    const attendees = submissionsByQuizId[quiz.id]?.length || 0;
    const absences = numberOfStudents - attendees;

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

  return reports;
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

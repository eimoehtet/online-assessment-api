const prisma = require("../config/prisma");

const coursePublicInclude = {
  teacher: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
    },
  },
  _count: { select: { enrollments: true, quizzes: true } },
};

const createCourse = async (data) => {
  return prisma.course.create({
    data,
    include: coursePublicInclude,
  });
};

const listCourses = async ({ skip, take, teacher_id, search, status, shift }) => {
  const where = {
    ...(teacher_id ? { teacher_id } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(shift ? { shift } : {}),
    ...(search ? { OR: [{ name: { contains: search } }, { code: { contains: search } }] } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.course.findMany({
      where,
      skip,
      take,
      orderBy: { id: "asc" },
      include: coursePublicInclude,
    }),
    prisma.course.count({ where }),
  ]);

  return { items, total };
};

const getCourseById = async (id) => {
  return prisma.course.findUnique({
    where: { id },
    include: coursePublicInclude,
  });
};

const getCourseByTeacherId = async (teacher_id, { skip, take } = {}) => {
  const where = { teacher_id };
  const [items, total] = await Promise.all([
    prisma.course.findMany({
      where,
      skip,
      take,
      orderBy: { id: "asc" },
      include: {
        ...coursePublicInclude,
        _count: { select: { enrollments: true } },
      },
    }),
    prisma.course.count({ where }),
  ]);
  return { items, total };
};

const getCourseRoster = async (courseId, { skip, take, search, shift } = {}) => {
  const where = {
    course_id: courseId,
    ...(shift ? { shift } : {}),
    ...(search
      ? {
          student: {
            OR: [
              { name: { contains: search } },
              { student_id: { contains: search } },
            ],
          },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      skip,
      take,
      orderBy: [{ student: { name: "asc" } }, { id: "asc" }],
      select: {
        id: true,
        shift: true,
        student: {
          select: {
            id: true,
            student_id: true,
            name: true,
            email: true,
            gender: true,
          },
        },
      },
    }),
    prisma.enrollment.count({ where }),
  ]);

  return { items, total };
};

const quizAvailability = (quiz, now = new Date()) => {
  if (quiz.status !== "PUBLISHED") return "UNAVAILABLE";
  if (quiz.start_date > now) return "UPCOMING";
  if (quiz.end_date <= now) return "CLOSED";
  const inProgress = quiz.submissions?.some((submission) => submission.status === "IN_PROGRESS");
  if (inProgress) return "IN_PROGRESS";
  if ((quiz.submissions?.length || 0) >= quiz.allowed_attempts) return "COMPLETED";
  if (quiz.quizAttendances?.[0]?.status === false) return "ABSENT";
  return "AVAILABLE";
};

const studentCourseSelect = (studentId) => ({
  id: true,
  shift: true,
  course: {
    select: {
      id: true, name: true, code: true, shift: true, status: true,
      teacher: { select: { id: true, name: true } },
      quizzes: {
        where: { status: "PUBLISHED" },
        orderBy: { end_date: "asc" },
        select: {
          id: true, title: true, status: true, start_date: true, end_date: true,
          time_limit: true, allowed_attempts: true,
          quizAttendances: { where: { student_id: studentId }, select: { status: true } },
          submissions: { where: { student_id: studentId }, select: { id: true, status: true, completed_at: true, submitted_at: true, total_score: true } },
          questions: { select: { points: true } },
        },
      },
    },
  },
});

const enrichStudentQuiz = (quiz) => ({
  ...quiz,
  availability: quizAvailability(quiz),
  attempts_used: quiz.submissions.length,
  latest_submission: quiz.submissions.at(-1) || null,
  maximum_score: quiz.questions.reduce((sum, question) => sum + (question.points || 0), 0),
  questions: undefined,
});

const getCoursesForStudent = async (studentId) => {
  const enrollments = await prisma.enrollment.findMany({
    where: { student_id: studentId },
    orderBy: { course: { name: "asc" } },
    select: studentCourseSelect(studentId),
  });
  return enrollments.map((enrollment) => {
    const quizzes = enrollment.course.quizzes.map(enrichStudentQuiz);
    const actionable = quizzes.filter((quiz) => ["AVAILABLE", "IN_PROGRESS"].includes(quiz.availability));
    return {
      id: enrollment.id,
      shift: enrollment.shift,
      course: { ...enrollment.course, quizzes: undefined },
      quiz_summary: {
        available: actionable.length,
        completed: quizzes.filter((quiz) => quiz.availability === "COMPLETED").length,
        nearest_deadline: actionable[0]?.end_date || null,
      },
    };
  });
};

const getCourseQuizzesForStudent = async (studentId, courseId) => {
  const enrollment = await prisma.enrollment.findUnique({
    where: { student_id_course_id: { student_id: studentId, course_id: courseId } },
    select: studentCourseSelect(studentId),
  });
  if (!enrollment) return null;
  return {
    enrollment: { id: enrollment.id, shift: enrollment.shift },
    course: { ...enrollment.course, quizzes: undefined },
    quizzes: enrollment.course.quizzes.map(enrichStudentQuiz),
  };
};

const findCourseByCode = async (code) => {
  return prisma.course.findFirst({
    where: { code },
    include: coursePublicInclude,
  });
};

const updateCourseById = async (id, data) => {
  return prisma.course.update({
    where: { id },
    data,
    include: coursePublicInclude,
  });
};

const deleteCourseById = async (id) => {
  return prisma.course.delete({
    where: { id },
    include: coursePublicInclude,
  });
};

const toggleCourseStatus = async (id) => {
  const course = await prisma.course.findUnique({
    where: { id },
  });

  if (!course) {
    throw new Error("Course not found");
  }

  const newStatus = !course.status;

  return prisma.course.update({
    where: { id },
    data: { status: newStatus },
    include: coursePublicInclude,
  });
};

module.exports = {
  createCourse,
  listCourses,
  getCourseById,
  findCourseByCode,
  updateCourseById,
  deleteCourseById,
  getCourseByTeacherId,
  getCourseRoster,
  getCoursesForStudent,
  getCourseQuizzesForStudent,
  quizAvailability,
  toggleCourseStatus,
};

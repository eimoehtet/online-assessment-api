const prisma = require("../config/prisma");

const getAdminStats = async () => {
  const [courses, teachers, students, quizzes, publishedQuizzes, recentQuizzes] = await Promise.all([
    prisma.course.count(),
    prisma.user.count({ where: { role: "TEACHER" } }),
    prisma.user.count({ where: { role: "STUDENT" } }),
    prisma.quiz.count(),
    prisma.quiz.findMany({
      where: { status: "PUBLISHED" },
      take: 10,
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        title: true,
        start_date: true,
        end_date: true,
        status: true,
        course: { select: { id: true, name: true } },
        teacher: { select: { id: true, name: true } },
      },
    }),
    prisma.quiz.findMany({
      take: 10,
      orderBy: { id: "desc" },
      select: {
        id: true, title: true, start_date: true, end_date: true, status: true,
        course: { select: { id: true, name: true } },
        teacher: { select: { id: true, name: true } },
      },
    }),
  ]);
  return { courses, teachers, students, quizzes, publishedQuizzes, recentQuizzes };
};

const getTeacherStats = async (teacherId) => {
  const [courses, quizzes, submissions] = await Promise.all([
    prisma.course.count({ where: { teacher_id: teacherId } }),
    prisma.quiz.count({ where: { teacher_id: teacherId } }),
    prisma.submission.count({ where: { quiz: { teacher_id: teacherId } } }),
  ]);
  return { courses, quizzes, submissions };
};

const getStudentStats = async (studentId) => {
  const [courses, submissions] = await Promise.all([
    prisma.enrollment.count({ where: { student_id: studentId } }),
    prisma.submission.count({ where: { student_id: studentId } }),
  ]);
  return { courses, submissions };
};

const getDashboardStats = (user) => {
  if (user.role === "ADMIN") return getAdminStats();
  if (user.role === "TEACHER") return getTeacherStats(user.id);
  return getStudentStats(user.id);
};

module.exports = { getDashboardStats };

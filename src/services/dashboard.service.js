const prisma = require("../config/prisma");
const { getCoursesForStudent } = require("./course.service");

const getAdminStats = async () => {
  const [courses, teachers, students, quizzes, publishedQuizzes, recentQuizzes, inactiveUsers, emptyCourses, readyToRelease] = await Promise.all([
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
    prisma.user.count({ where: { status: 0 } }),
    prisma.course.count({ where: { enrollments: { none: {} } } }),
    prisma.submission.count({ where: { status: "GRADED" } }),
  ]);
  return { courses, teachers, students, quizzes, publishedQuizzes, recentQuizzes, inactiveUsers, emptyCourses, readyToRelease };
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
  const [courseRows, awaitingReview, releasedCount, releasedResults] = await Promise.all([
    getCoursesForStudent(studentId),
    prisma.submission.count({ where: { student_id: studentId, status: { in: ["SUBMITTED", "IN_REVIEW", "GRADED"] } } }),
    prisma.submission.count({ where: { student_id: studentId, status: "RELEASED" } }),
    prisma.submission.findMany({
      where: { student_id: studentId, status: "RELEASED" },
      take: 5,
      orderBy: { released_at: "desc" },
      select: {
        id: true, total_score: true, released_at: true,
        quiz: {
          select: {
            id: true, title: true,
            questions: { select: { points: true } },
            course: { select: { id: true, name: true, code: true } },
          },
        },
      },
    }),
  ]);
  const courseDetails = await prisma.enrollment.findMany({
    where: { student_id: studentId },
    select: { course: { select: { id: true, name: true, code: true, quizzes: { where: { status: "PUBLISHED" }, select: { id: true, title: true, start_date: true, end_date: true, time_limit: true, allowed_attempts: true, submissions: { where: { student_id: studentId }, select: { id: true, status: true } } } } } } },
  });
  const now = new Date();
  const actionable = courseDetails.flatMap(({ course }) => course.quizzes.filter((quiz) => quiz.start_date <= now && quiz.end_date > now && (quiz.submissions.length < quiz.allowed_attempts || quiz.submissions.some((item) => item.status === "IN_PROGRESS"))).map((quiz) => ({ ...quiz, course: { id: course.id, name: course.name, code: course.code } }))).sort((a, b) => a.end_date - b.end_date);
  return {
    courses: courseRows.length,
    submissions: releasedCount + awaitingReview,
    available_quizzes: actionable.length,
    awaiting_review: awaitingReview,
    newly_released: releasedResults.length,
    upcoming_quizzes: actionable.slice(0, 5),
    recent_results: releasedResults.map((result) => ({ ...result, maximum_score: result.quiz.questions.reduce((sum, question) => sum + (question.points || 0), 0), quiz: { ...result.quiz, questions: undefined } })),
    course_summaries: courseRows.slice(0, 3),
  };
};

const getDashboardStats = (user) => {
  if (user.role === "ADMIN") return getAdminStats();
  if (user.role === "TEACHER") return getTeacherStats(user.id);
  return getStudentStats(user.id);
};

module.exports = { getDashboardStats };

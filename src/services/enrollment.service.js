const prisma = require("../config/prisma");

const publicInclude = {
  course: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
  student: {
    select: {
      id: true,
      name: true,
      email: true,
      student_id: true,
      phone_number: true,
      gender: true,
      address: true,
      date_of_birth: true,
    },
  },
};

const createEnrollment = async (courseId, studentId, shift) => {
  console.log("Creating enrollment with courseId:", courseId, "studentId:", studentId, "shift:", shift);
  if (!courseId) {
    throw new Error("courseId is required.");
  }
  if (!studentId) {
    throw new Error("studentId is required.");
  }
  if (!shift) {
    throw new Error("shift is required.");
  }
  return prisma.enrollment.create({
    data: { course_id: parseInt(courseId, 10), student_id: studentId, shift },
    include: publicInclude,
  });
};

const createBulkEnrollments = async (studentId, courseIds, shift) => {
  const enrollmentData = courseIds.map(courseId => ({
    student_id: studentId,
    course_id: parseInt(courseId, 10),
    shift,
  }));

  return prisma.enrollment.createMany({
    data: enrollmentData,
    skipDuplicates: true,
  });
};

const listEnrollments = async ({ skip, take, course_id, student_id }) => {
  const where = {};
  if (course_id) where.course_id = course_id;
  if (student_id) where.student_id = student_id;

  const [items, total] = await Promise.all([
    prisma.enrollment.findMany({
      where,
      skip,
      take,
      orderBy: { id: "asc" },
      include: publicInclude,
    }),
    prisma.enrollment.count({ where }),
  ]);

  return { items, total };
};

const getEnrollmentById = async (id) => {
  return prisma.enrollment.findUnique({
    where: { id },
    include: publicInclude,
  });
};

const getEnrollmentsByCourse = async (courseId) => {
  const [items, total] = await Promise.all([
    prisma.enrollment.findMany({
    where: { course_id: courseId },
      include: publicInclude,
    }),
    prisma.enrollment.count({ where: { course_id: courseId } }),
  ]);

  return { items, total };
};

const getEnrollmentsByStudent = async (studentId) => {
  return prisma.enrollment.findMany({
    where: { student_id: studentId },
    include: publicInclude,
  });
};

const updateEnrollment = async (id, course_id, student_id, shift) => {
  return prisma.enrollment.update({
    where: { id },
    data: { course_id, student_id, shift },
    include: publicInclude,
  });
};

const deleteEnrollmentById = async (id) => {
  return prisma.enrollment.delete({
    where: { id },
  });
};

module.exports = {
  createEnrollment,
  createBulkEnrollments,
  listEnrollments,
  getEnrollmentById,
  updateEnrollment,
  deleteEnrollmentById,
  getEnrollmentsByCourse,
  getEnrollmentsByStudent
};

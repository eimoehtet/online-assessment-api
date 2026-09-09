const prisma = require("../config/prisma");

const publicInclude = {
  course: {
    select: {
      id: true,
      name: true,
      code: true,
      teacher: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
  student: {
    select: {
      id: true,
      name: true,
      email: true,
      student_id: true,
      major: true,
      gender: true,
    },
  },
};

const createEnrollment = async (courseId, studentId, shift) => {
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

const getEnrollmentsByCourse = async (courseId, { skip, take, search, shift } = {}) => {
  const where = { course_id: courseId, ...(shift ? { shift } : {}), ...(search ? { student: { OR: [{ name: { contains: search } }, { student_id: { contains: search } }] } } : {}) };
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

const getEnrollmentsByStudent = async (studentId, { skip, take } = {}) => {
  const where = { student_id: studentId };
  const [items, total] = await Promise.all([
    prisma.enrollment.findMany({ where, skip, take, orderBy: { id: "asc" }, include: publicInclude }),
    prisma.enrollment.count({ where }),
  ]);
  return { items, total };
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

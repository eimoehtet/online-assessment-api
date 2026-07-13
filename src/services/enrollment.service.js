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

const createEnrollment = async (course_id, student_id) => {
  return prisma.enrollment.create({
    data: { course_id, student_id },
    include: publicInclude,
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
  return prisma.enrollment.findMany({
    where: { course_id: courseId },
    include: publicInclude,
  });
};

const updateEnrollment = async (id, course_id, student_id) => {
  return prisma.enrollment.update({
    where: { id },
    data: { course_id, student_id },
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
  listEnrollments,
  getEnrollmentById,
  updateEnrollment,
  deleteEnrollmentById,
  getEnrollmentsByCourse,
};

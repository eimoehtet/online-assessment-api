const prisma = require("../config/prisma");

const coursePublicInclude = {
  teacher: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
};

const createCourse = async (data) => {
  return prisma.course.create({
    data,
    include: coursePublicInclude,
  });
};

const listCourses = async ({ skip, take, teacher_id }) => {
  const where = teacher_id ? { teacher_id } : undefined;

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

module.exports = {
  createCourse,
  listCourses,
  getCourseById,
  findCourseByCode,
  updateCourseById,
  deleteCourseById,
};

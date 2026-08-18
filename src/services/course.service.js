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

const getCourseByTeacherId = async (teacher_id, { skip, take } = {}) => {
  const where = { teacher_id };
  const [items, total] = await Promise.all([
    prisma.course.findMany({ where, skip, take, orderBy: { id: "asc" }, include: coursePublicInclude }),
    prisma.course.count({ where }),
  ]);
  return { items, total };
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
  toggleCourseStatus,
};

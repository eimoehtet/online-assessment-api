const prisma = require("../config/prisma");
const bcrypt = require("bcrypt");

const userPublicSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  gender: true,
  student_id: true,
  phone_number: true,
  date_of_birth: true,
  address: true,
  createdAt: true,
  updatedAt: true,
};

const findUserByEmail = async (email) => {
  return prisma.user.findUnique({
    where: { email },
  });
};

const findUserByStudentId = async (student_id) => {
  return prisma.user.findUnique({
    where: { student_id },
  });
};

const createUser = async (data) => {
  return prisma.user.create({
    data,
    select: userPublicSelect,
  });
};

const listUsers = async ({ skip, take, role }) => {
  const where = role ? { role } : undefined;

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: { id: "asc" },
      select: userPublicSelect,
    }),
    prisma.user.count({ where }),
  ]);

  return { items, total };
};

const getTeachers = async ({ skip, take, role }) => {
  const where = { role: "TEACHER" };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: { id: "asc" },
      select: userPublicSelect,
    }),
    prisma.user.count({ where }),
  ]);
  return { items, total };
};

const getStudents = async ({ skip, take, role }) => {
  const where = { role: "STUDENT" };

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: { id: "asc" },
      select: userPublicSelect,
    }),
    prisma.user.count({ where }),
  ]);
  return { items, total };
};

const getUserById = async (id) => {
  return prisma.user.findUnique({
    where: { id },
    select: userPublicSelect,
  });
};

const updateUserById = async (id, data) => {
  return prisma.user.update({
    where: { id },
    data,
    select: userPublicSelect,
  });
};

const deleteUserById = async (id) => {
  return prisma.user.delete({
    where: { id },
    select: userPublicSelect,
  });
};

const resetPassword = async(id, newPassword) => {
  return prisma.user.update({
    where: { id },
    data: { password: newPassword }, 
    select: userPublicSelect,
  });
}

const changePassword = async(id, currentPassword, newPassword) => {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
  if (!isPasswordValid) {
    throw new Error("Current password is incorrect");
  }

  return prisma.user.update({
    where: { id },
    data: { password: newPassword },
    select: userPublicSelect,
  });

}

module.exports = {
  findUserByEmail,
  findUserByStudentId,
  createUser,
  listUsers,
  getUserById,
  updateUserById,
  deleteUserById,
  resetPassword,
  changePassword,
  getTeachers,
  getStudents,
};

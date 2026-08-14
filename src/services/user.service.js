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
  status: true,
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

const revokeAllUserSessions = (id) => prisma.authSession.updateMany({
  where: { user_id: id, revokedAt: null },
  data: { revokedAt: new Date() },
});

const toggleUserStatus = async (id) => {
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const newStatus = user?.status === 1 ? 0 : 1;
  console.log(`Current status: ${user.status}, New status: ${newStatus}`); // Debugging line
  return prisma.user.update({
    where: { id },
    data: { status: newStatus },
  });
};

const crypto = require("crypto");
const { sendResetPasswordEmail } = require("./email.service");

const forgotPassword = async (emailOrId) => {
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: emailOrId },
        { student_id: emailOrId }
      ]
    }
  });

  if (!user) {
    return { success: true, message: "If an account with that email/ID exists, a password reset link has been sent." };
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetExpires = new Date(Date.now() + 3600000); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: {
      reset_password_token: resetToken,
      reset_password_expires: resetExpires,
    },
  });

  await sendResetPasswordEmail(user.email, resetToken, user.name);

  return { success: true, message: "If an account with that email/ID exists, a password reset link has been sent." };
};

const resetPasswordWithToken = async (token, newPassword) => {
  if (!token || !newPassword) {
    const error = new Error("Token and new password are required.");
    error.statusCode = 400;
    throw error;
  }

  const user = await prisma.user.findFirst({
    where: {
      reset_password_token: token,
      reset_password_expires: {
        gte: new Date(),
      },
    },
  });

  if (!user) {
    const error = new Error("Invalid or expired password reset token.");
    error.statusCode = 400;
    throw error;
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      reset_password_token: null,
      reset_password_expires: null,
    },
  });

  await revokeAllUserSessions(user.id);

  return { success: true, message: "Password has been successfully reset." };
};

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
  revokeAllUserSessions,
  getTeachers,
  getStudents,
  toggleUserStatus,
  forgotPassword,
  resetPasswordWithToken,
};

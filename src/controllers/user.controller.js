const bcrypt = require("bcrypt");
const {
  findUserByEmail,
  createUser,
  listUsers,
  getUserById,
  updateUserById,
  deleteUserById,
  resetPassword,
  changePassword,
  getTeachers,
  getStudents,
  toggleUserStatus,
  forgotPassword,
  resetPasswordWithToken,
  revokeAllUserSessions,
} = require("../services/user.service");
const {
  createSession,
  refreshSession,
  revokeSessionFromToken,
} = require("../services/auth.service");
const { getPagination } = require("../utils/pagination");

const allowedRoles = ["ADMIN", "TEACHER", "STUDENT"];

const refreshCookieOptions = () => {
  const isProduction = process.env.NODE_ENV === "production";
  const secure = process.env.AUTH_COOKIE_SECURE
    ? process.env.AUTH_COOKIE_SECURE === "true"
    : isProduction;
  const sameSite = process.env.AUTH_COOKIE_SAME_SITE || (isProduction ? "none" : "lax");

  if (sameSite === "none" && !secure) {
    throw new Error("AUTH_COOKIE_SAME_SITE=none requires AUTH_COOKIE_SECURE=true.");
  }

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: "/api/users",
  };
};

const setRefreshCookie = (res, token, expiresAt) => {
  res.cookie("refresh_token", token, { ...refreshCookieOptions(), expires: expiresAt });
};

const clearRefreshCookie = (res) => {
  res.clearCookie("refresh_token", refreshCookieOptions());
};

const getRefreshToken = (req) => {
  const header = req.headers.cookie;
  if (!header) return null;
  const cookie = header.split(";").map((value) => value.trim()).find((value) => value.startsWith("refresh_token="));
  if (!cookie) return null;
  try {
    return decodeURIComponent(cookie.slice("refresh_token=".length));
  } catch (_error) {
    return null;
  }
};

const getUniqueConflictMessage = (error) => {
  const target = error?.meta?.target;
  const rawTokens = Array.isArray(target)
    ? target
    : typeof target === "string"
      ? [target]
      : [];

  const normalizedTokens = rawTokens.map((token) =>
    String(token).toLowerCase(),
  );
  const combined = normalizedTokens.join(" ");

  if (combined.includes("email")) {
    return "Email already in use.";
  }

  if (combined.includes("phone_number") || combined.includes("phone")) {
    return "Phone number already in use.";
  }

  if (combined.includes("student_id") || combined.includes("student")) {
    return "Student/Teacher ID already in use.";
  }

  return "Duplicate value already exists.";
};

const parseUserId = (value) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const normalizeOptionalString = (value) => {
  if (value === undefined || value === null) return null;
  return typeof value === "string" && value.trim() === "" ? null : value;
};

const parseOptionalDate = (value) => {
  if (value === undefined || value === null || value === "") return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
};

const login = async (req, res) => {
  try {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ message: "Email and password are required." });
  }

  const user = await findUserByEmail(email);

  if (!user) {
    return res.status(401).json({ message: "Invalid email or password." });
  }


  if (user.status === 0) {
    return res.status(403).json({ message: "User account is deactivated." });
  } 
  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const {
    password: _,
    reset_password_token: __,
    reset_password_expires: ___,
    ...userWithoutPassword
  } = user;
  const session = await createSession(user);
  setRefreshCookie(res, session.refreshToken, session.expiresAt);

  return res.status(200).json({
    message: "Login successful.",
    accessToken: session.accessToken,
    csrfToken: session.csrfToken,
    user: userWithoutPassword,
  });
  } catch (error) {
    console.error("Login failed:", error);
    return res.status(500).json({ message: "Unable to create a login session." });
  }
};

const refresh = async (req, res) => {
  const session = await refreshSession(
    getRefreshToken(req),
    req.get("X-CSRF-Token"),
  );

  if (!session) {
    clearRefreshCookie(res);
    return res.status(401).json({ message: "Session expired or invalid." });
  }

  const { password: _, reset_password_token: __, reset_password_expires: ___, ...user } = session.user;
  setRefreshCookie(res, session.refreshToken, session.expiresAt);
  return res.status(200).json({ accessToken: session.accessToken, csrfToken: session.csrfToken, user });
};

const logout = async (req, res) => {
  await revokeSessionFromToken(getRefreshToken(req), req.get("X-CSRF-Token"));
  clearRefreshCookie(res);
  return res.status(204).send();
};

const getCurrentUser = async (req, res) => {
  const user = await getUserById(req.user.id);
  return res.status(200).json({ user });
};

const createUserByAdmin = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      student_id = null,
      phone_number,
      date_of_birth,
      gender,
      address,
    } = req.body;

    if(!name){
      return res.status(400).json({ message: "Name is required." });
    }
    if(!email){
      return res.status(400).json({ message: "Email is required." });
    }
    if(!password){
      return res.status(400).json({ message: "Password is required." });
    }
    if (typeof password !== "string" || password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long." });
    }
    if(!role){
      return res.status(400).json({ message: "Role is required." });
    }
    if(!gender){
      return res.status(400).json({ message: "Gender is required." });
    }
    if(!student_id && role === "STUDENT"){
      return res.status(400).json({ message: "Student ID is required for students." });
    }
    if(!student_id && role === "TEACHER"){
      return res.status(400).json({ message: "Teacher ID is required for teachers." });
    }
    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role." });
    }

    const parsedDateOfBirth = parseOptionalDate(date_of_birth);
    if (parsedDateOfBirth === undefined) {
      return res.status(400).json({ message: "Date of birth is invalid." });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: "Email already in use." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const createdUser = await createUser({
      name,
      email,
      password: hashedPassword,
      role,
      student_id,
      phone_number: normalizeOptionalString(phone_number),
      date_of_birth: parsedDateOfBirth,
      gender,
      address: normalizeOptionalString(address),
    });

    return res.status(201).json({
      message: "User created successfully.",
      user: createdUser,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: getUniqueConflictMessage(error) });
    }

    return res.status(500).json({ message: `Failed to create user. ${error}` });
  }
};

const getUsersByAdmin = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const role = req.query.role;

    if (role && !allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role filter." });
    }

    const { items, total } = await listUsers({
      skip,
      take: limit,
      role,
    });

    return res.status(200).json({
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (_error) {
    return res.status(500).json({ message: "Failed to fetch users." });
  }
};

const getTeachersByAdmin = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const role = req.query.role;
    if (role && role !== "TEACHER") {
      return res.status(400).json({ message: "Invalid role filter for teachers." });
    }
    const { items, total } = await getTeachers({ skip, take: limit });
    return res.status(200).json({
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (_error) {
    return res.status(500).json({ message: "Failed to fetch teachers." });
  }
};

const getStudentsByAdmin = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const role = req.query.role;

    if (role && role !== "STUDENT") {
      return res.status(400).json({ message: "Invalid role filter for students." });
    }

    const { items, total } = await getStudents({ skip, take: limit });
    return res.status(200).json({
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (_error) {
    return res.status(500).json({ message: "Failed to fetch students." });
  }
};

const getUserByIdByAdmin = async (req, res) => {
  try {
    const userId = parseUserId(req.params.id);
    if (!userId) {
      return res.status(400).json({ message: "Invalid user id." });
    }

    const user = await getUserById(userId);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.status(200).json({ user });
  } catch (_error) {
    return res.status(500).json({ message: "Failed to fetch user." });
  }
};

const updateUserByAdmin = async (req, res) => {
  try {
    const userId = parseUserId(req.params.id);
    if (!userId) {
      return res.status(400).json({ message: "Invalid user id." });
    }

    const {
      name,
      email,
      password,
      role,
      student_id,
      phone_number,
      date_of_birth,
      gender,
      address,
    } = req.body;

    const data = {};

    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (student_id !== undefined) data.student_id = student_id;
    if (phone_number !== undefined) data.phone_number = normalizeOptionalString(phone_number);
    if (address !== undefined) data.address = normalizeOptionalString(address);
    if (date_of_birth !== undefined) {
      const parsedDateOfBirth = parseOptionalDate(date_of_birth);
      if (parsedDateOfBirth === undefined) {
        return res.status(400).json({ message: "Date of birth is invalid." });
      }
      data.date_of_birth = parsedDateOfBirth;
    }
    if (gender !== undefined) data.gender = gender;

    if (role !== undefined) {
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role." });
      }
      data.role = role;
    }

    if (password !== undefined) {
      if (typeof password !== "string" || password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters long." });
      }
      data.password = await bcrypt.hash(password, 10);
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "No data provided for update." });
    }

    const updatedUser = await updateUserById(userId, data);
    if (password !== undefined || role !== undefined) {
      await revokeAllUserSessions(userId);
    }

    return res.status(200).json({
      message: "User updated successfully.",
      user: updatedUser,
    });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "User not found." });
    }

    if (error.code === "P2002") {
      return res.status(409).json({ message: getUniqueConflictMessage(error) });
    }

    return res.status(500).json({ message: "Failed to update user." });
  }
};

const deleteUserByAdmin = async (req, res) => {
  try {
    const userId = parseUserId(req.params.id);
    if (!userId) {
      return res.status(400).json({ message: "Invalid user id." });
    }

    await revokeAllUserSessions(userId);
    await deleteUserById(userId);

    return res.status(200).json({ message: "User deleted successfully." });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "User not found." });
    }

    return res.status(500).json({ message: "Failed to delete user." });
  }
};

const resetUserPasswordByAdmin = async (req, res) => {
  try {
    const userId = parseUserId(req.params.id);
    if (!userId) {
      return res.status(400).json({ message: "Invalid user id." });
    }

    const defaultPassword = req.body.newPassword || "Default@123";
    if (typeof defaultPassword !== "string" || defaultPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long." });
    }
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    await updateUserById(userId, { password: hashedPassword });
    await revokeAllUserSessions(userId);

    return res.status(200).json({ message: "Password reset successfully." });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "User not found." });
    }

    return res.status(500).json({ message: "Failed to reset password." });
  }
};

const changePasswordByUser = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new passwords are required." });
    }
    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await changePassword(req.user.id, currentPassword, hashedPassword);
    await revokeAllUserSessions(req.user.id);

    return res.status(200).json({ success: true, message: "Password changed successfully." });
  } catch (error) {
    console.error("Error changing password:", error);
    if (error.message === "Current password is incorrect") {
      return res.status(400).json({ message: error.message });
    }
    if (error.code === "P2025") {
      return res.status(404).json({ message: "User not found." });
    }

    return res.status(500).json({ message: "Failed to change password." });
  }
};

const toggleUserStatusByAdmin = async (req, res) => {
  try {
    const userId = parseUserId(req.params.id);
    if (!userId) {
      return res.status(400).json({ message: "Invalid user id." });
    }

    const changed = await toggleUserStatus(userId);
    if (changed.status === 0) {
      await revokeAllUserSessions(userId);
    }

    return res.status(200).json({
      message: `User ${changed.status ? "activated" : "deactivated"} successfully.`,
      status: changed.status,
    });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "User not found." });
    }

    return res.status(500).json({ message: "Failed to toggle user status." });
  }
};

const forgotPasswordController = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email or User ID is required." });
    }

    const result = await forgotPassword(email);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error sending forgot password email:", error);
    return res.status(500).json({ message: error.message || "Failed to process request." });
  }
};

const resetPasswordWithTokenController = async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token and new password are required." });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long." });
    }

    const result = await resetPasswordWithToken(token, newPassword);
    return res.status(200).json(result);
  } catch (error) {
    console.error("Error resetting password:", error);
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({ message: error.message || "Failed to reset password." });
  }
};

module.exports = {
  login,
  refresh,
  logout,
  getCurrentUser,
  createUserByAdmin,
  getUsersByAdmin,
  getUserByIdByAdmin,
  updateUserByAdmin,
  resetUserPasswordByAdmin,
  changePasswordByUser,
  deleteUserByAdmin,
  getTeachersByAdmin,
  getStudentsByAdmin,
  toggleUserStatusByAdmin,
  forgotPasswordController,
  resetPasswordWithTokenController,
};

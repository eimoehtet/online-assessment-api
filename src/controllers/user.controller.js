const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const {
  findUserByEmail,
  createUser,
  listUsers,
  getUserById,
  updateUserById,
  deleteUserById,
  resetPassword,
  changePassword,
  getTeachers
} = require("../services/user.service");

const allowedRoles = ["ADMIN", "TEACHER", "STUDENT"];

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
    return "Student ID already in use.";
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

const getPagination = (query) => {
  const page = Math.max(Number.parseInt(query.page || "1", 10), 1);
  const limit = Math.min(
    Math.max(Number.parseInt(query.limit || "10", 10), 1),
    100,
  );

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

const login = async (req, res) => {
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

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    return res.status(401).json({ message: "Invalid email or password." });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "8h" },
  );

  const { password: _, ...userWithoutPassword } = user;

  return res.status(200).json({
    message: "Login successful.",
    token,
    user: userWithoutPassword,
  });
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

    if (
      !name ||
      !email ||
      !password ||
      !role ||
      !phone_number ||
      !date_of_birth ||
      !gender ||
      !address
    ) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Invalid role." });
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
      phone_number,
      date_of_birth: new Date(date_of_birth),
      gender,
      address,
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
    const teachersList = await getTeachers();
    return res.status(200).json({ data: teachersList });
  } catch (_error) {
    return res.status(500).json({ message: "Failed to fetch teachers." });
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
    if (phone_number !== undefined) data.phone_number = phone_number;
    if (address !== undefined) data.address = address;
    if (date_of_birth !== undefined) data.date_of_birth = new Date(date_of_birth);
    if (gender !== undefined) data.gender = gender;

    if (role !== undefined) {
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({ message: "Invalid role." });
      }
      data.role = role;
    }

    if (password !== undefined) {
      data.password = await bcrypt.hash(password, 10);
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "No data provided for update." });
    }

    const updatedUser = await updateUserById(userId, data);

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
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    await updateUserById(userId, { password: hashedPassword });

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
    const userId = parseUserId(req.params.id);
    if (!userId) {
      return res.status(400).json({ message: "Invalid user id." });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new passwords are required." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await changePassword(userId, currentPassword, hashedPassword);

    return res.status(200).json({ message: "Password changed successfully." });
  } catch (error) {
    console.error("Error changing password:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ message: "User not found." });
    }

    return res.status(500).json({ message: "Failed to change password." });
  }
};

module.exports = {
  login,
  createUserByAdmin,
  getUsersByAdmin,
  getUserByIdByAdmin,
  updateUserByAdmin,
  resetUserPasswordByAdmin,
  changePasswordByUser,
  deleteUserByAdmin,
  getTeachersByAdmin,
};

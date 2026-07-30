const {
  createCourse: createCourseRecord,
  listCourses,
  getCourseById,
  getCourseByTeacherId,
  findCourseByCode,
  updateCourseById,
  deleteCourseById,
} = require("../services/course.service");
const { getUserById } = require("../services/user.service");

const allowedRoles = ["ADMIN", "TEACHER"];

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

  return "Duplicate value already exists.";
};

const parseCourseId = (value) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const parseTeacherId = (value) => {
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

const createCourse = async (req, res) => {
  try {
    const { name, code, shift, teacher_id } = req.body;

    if (!name || !code || !shift || teacher_id === undefined) {
      return res.status(400).json({
        message: "Name, code, shift, and teacher_id are required.",
      });
    }

    const teacherId = parseTeacherId(teacher_id);
    if (!teacherId) {
      return res.status(400).json({ message: "Invalid teacher_id." });
    }

    const teacher = await getUserById(teacherId);
    if (!teacher) {
      return res.status(404).json({ message: "Teacher not found." });
    }

    if (teacher.role !== "TEACHER") {
      return res.status(400).json({
        message: "teacher_id must belong to a user with TEACHER role.",
      });
    }

    const course = await createCourseRecord({
      name,
      code,
      shift,
      teacher_id: teacherId,
    });

    return res.status(201).json({
      message: "Course created successfully.",
      course,
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({ message: getUniqueConflictMessage(error) });
    }

    return res.status(500).json({ message: "Failed to create course." });
  }
};

const getCourses = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const teacherId =
      req.query.teacher_id !== undefined
        ? parseTeacherId(req.query.teacher_id)
        : undefined;

    if (req.query.teacher_id !== undefined && !teacherId) {
      return res.status(400).json({ message: "Invalid teacher_id filter." });
    }

    const { items, total } = await listCourses({
      skip,
      take: limit,
      teacher_id: teacherId,
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
    return res.status(500).json({ message: "Failed to fetch courses." });
  }
};

const getCourseByIdHandler = async (req, res) => {
  try {
    const courseId = parseCourseId(req.params.id);
    if (!courseId) {
      return res.status(400).json({ message: "Invalid course id." });
    }

    const course = await getCourseById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found." });
    }

    return res.status(200).json({ course });
  } catch (_error) {
    return res.status(500).json({ message: "Failed to fetch course." });
  }
};

const getCourseByTeacherIdHandler = async (req, res) => {
  try {
    const teacherId = parseTeacherId(req.params.teacherId);
    if (!teacherId) {
      return res.status(400).json({ message: "Invalid teacher_id." });
    }

    const courses = await getCourseByTeacherId(teacherId);
    return res.status(200).json({ courses });
  } catch (_error) {
    return res.status(500).json({ message: "Failed to fetch courses." });
  }
};

const updateCourse = async (req, res) => {
  try {
    const courseId = parseCourseId(req.params.id);
    if (!courseId) {
      return res.status(400).json({ message: "Invalid course id." });
    }

    const { name, code, teacher_id, shift } = req.body;
    const data = {};

    if (name !== undefined) {
      if (!name) {
        return res.status(400).json({ message: "Name cannot be empty." });
      }
      data.name = name;
    }

    if (code !== undefined) {
      if (!code) {
        return res.status(400).json({ message: "Code cannot be empty." });
      }

      const existingCourse = await findCourseByCode(code);
      if (existingCourse && existingCourse.id !== courseId) {
        return res.status(409).json({ message: "Course code already in use." });
      }

      data.code = code;
    }

    if (teacher_id !== undefined) {
      const teacherId = parseTeacherId(teacher_id);
      if (!teacherId) {
        return res.status(400).json({ message: "Invalid teacher_id." });
      }

      const teacher = await getUserById(teacherId);
      if (!teacher) {
        return res.status(404).json({ message: "Teacher not found." });
      }

      if (teacher.role !== "TEACHER") {
        return res.status(400).json({
          message: "teacher_id must belong to a user with TEACHER role.",
        });
      }

      data.teacher_id = teacherId;
    }

    if (shift !== undefined) {
      if (!shift) {
        return res.status(400).json({ message: "Shift cannot be empty." });
      }
      data.shift = shift;
    } 

    if (Object.keys(data).length === 0) {
      return res.status(400).json({ message: "No data provided for update." });
    }

    const course = await updateCourseById(courseId, data);

    return res.status(200).json({
      message: "Course updated successfully.",
      course,
    });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Course not found." });
    }

    if (error.code === "P2002") {
      return res.status(409).json({ message: getUniqueConflictMessage(error) });
    }

    return res.status(500).json({ message: "Failed to update course." });
  }
};

const deleteCourse = async (req, res) => {
  try {
    const courseId = parseCourseId(req.params.id);
    if (!courseId) {
      return res.status(400).json({ message: "Invalid course id." });
    }

    await deleteCourseById(courseId);

    return res.status(200).json({ message: "Course deleted successfully." });
  } catch (error) {
    if (error.code === "P2025") {
      return res.status(404).json({ message: "Course not found." });
    }

    return res.status(500).json({ message: "Failed to delete course." });
  }
};

module.exports = {
  createCourse,
  getCourses,
  getCourseById: getCourseByIdHandler,
  getCourseByTeacherId: getCourseByTeacherIdHandler,
  updateCourse,
  deleteCourse,
  allowedRoles,
  getUniqueConflictMessage,
  parseCourseId,
  getPagination,
};

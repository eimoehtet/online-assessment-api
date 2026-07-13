const {
  createEnrollment: createEnrollmentRecord,
  listEnrollments: listEnrollmentRecords,
  getEnrollmentById: getEnrollmentByIdRecord,
  updateEnrollment: updateEnrollmentRecord,
  deleteEnrollmentById: deleteEnrollmentRecord,
} = require("../services/enrollment.service");
const { getCourseById } = require("../services/course.service");
const { getUserById, findUserByStudentId, createUser } = require("../services/user.service");
const prisma = require("../config/prisma");
const bcrypt = require("bcrypt");

const allowedRoles = ["ADMIN","TEACHER", "STUDENT"];
// ...

const parseEnrollmentId = (value) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const parseUserId = (value) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const parseCourseId = (value) => {
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

  if (combined.includes("course_id")) {
    return "Student is already enrolled in this course.";
  }

  return "Duplicate value already exists.";
};

const createEnrollment = async (req, res) => {
  const courseId = parseCourseId(req.body.course_id);
  const requestedStudentId = parseUserId(req.body.student_id);

  if (!courseId || !requestedStudentId) {
    return res
      .status(400)
      .json({ message: "Valid course_id and student_id are required." });
  }

  const studentId =
    req.user.role === "STUDENT" ? req.user.id : requestedStudentId;

  if (req.user.role === "STUDENT" && studentId !== requestedStudentId) {
    return res
      .status(403)
      .json({ message: "Students can only create their own enrollment." });
  }

  try {
    const course = await getCourseById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found." });
    }

    const student = await getUserById(studentId);
    if (!student || student.role !== "STUDENT") {
      return res
        .status(404)
        .json({ message: "Student not found or invalid role." });
    }

    const enrollment = await createEnrollmentRecord(courseId, studentId);
    return res.status(201).json({
      message: "Enrollment created successfully.",
      enrollment,
    });
  } catch (error) {
    if (error.code === "P2002") {
      const message = getUniqueConflictMessage(error);
      return res.status(409).json({ message });
    }
    console.error("Error creating enrollment:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const listEnrollments = async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const courseId =
      req.query.course_id !== undefined
        ? parseCourseId(req.query.course_id)
        : undefined;
    const queryStudentId =
      req.query.student_id !== undefined
        ? parseUserId(req.query.student_id)
        : undefined;

    if (req.query.course_id !== undefined && !courseId) {
      return res.status(400).json({ message: "Invalid course_id filter." });
    }

    if (req.query.student_id !== undefined && !queryStudentId) {
      return res.status(400).json({ message: "Invalid student_id filter." });
    }

    if (
      req.user.role === "STUDENT" &&
      queryStudentId &&
      queryStudentId !== req.user.id
    ) {
      return res
        .status(403)
        .json({ message: "Students can only view their own enrollments." });
    }

    const { items, total } = await listEnrollmentRecords({
      skip,
      take: limit,
      course_id: courseId,
      student_id: req.user.role === "STUDENT" ? req.user.id : queryStudentId,
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
  } catch (error) {
    console.error("Error listing enrollments:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const getEnrollmentById = async (req, res) => {
  console.log("Fetching enrollment by ID:", req.params.id);
  const enrollmentId = parseEnrollmentId(req.params.id);
  if (!enrollmentId) {
    return res.status(400).json({ message: "Invalid enrollment ID." });
  }

  try {
    const enrollment = await getEnrollmentByIdRecord(enrollmentId);
    if (!enrollment) {
      return res.status(404).json({ message: "Enrollment not found." });
    }

    if (req.user.role === "STUDENT" && enrollment.student_id !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Students can only view their own enrollments." });
    }

    return res.json(enrollment);
  } catch (error) {
    console.error("Error fetching enrollment:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const getEnrollmentsByCourse = async (req, res) => {
  const courseId = parseCourseId(req.params.id);
  if (!courseId) {
    return res.status(400).json({ message: "Invalid course ID." });
  }

  try {
    const { page, limit, skip } = getPagination(req.query);

    const { items, total } = await listEnrollmentRecords({
      skip,
      take: limit,
      course_id: courseId,
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
  } catch (error) {
    console.error("Error fetching enrollments by course:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const updateEnrollment = async (req, res) => {
  const enrollmentId = parseEnrollmentId(req.params.id);
  if (!enrollmentId) {
    return res.status(400).json({ message: "Invalid enrollment ID." });
  }

  const courseId = parseCourseId(req.body.course_id);
  const requestedStudentId = parseUserId(req.body.student_id);

  if (!courseId || !requestedStudentId) {
    return res
      .status(400)
      .json({ message: "Valid course_id and student_id are required." });
  }

  try {
    const existingEnrollment = await getEnrollmentByIdRecord(enrollmentId);
    if (!existingEnrollment) {
      return res.status(404).json({ message: "Enrollment not found." });
    }

    if (
      req.user.role === "STUDENT" &&
      existingEnrollment.student_id !== req.user.id
    ) {
      return res
        .status(403)
        .json({ message: "Students can only update their own enrollments." });
    }

    const studentId =
      req.user.role === "STUDENT" ? req.user.id : requestedStudentId;

    if (req.user.role === "STUDENT" && requestedStudentId !== req.user.id) {
      return res
        .status(403)
        .json({
          message: "Students cannot reassign enrollment to another student.",
        });
    }

    const course = await getCourseById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found." });
    }

    const student = await getUserById(studentId);
    if (!student || student.role !== "STUDENT") {
      return res
        .status(404)
        .json({ message: "Student not found or invalid role." });
    }

    const updatedEnrollment = await updateEnrollmentRecord(
      enrollmentId,
      courseId,
      studentId,
    );
    return res.json(updatedEnrollment);
  } catch (error) {
    if (error.code === "P2002") {
      const message = getUniqueConflictMessage(error);
      return res.status(409).json({ message });
    }
    console.error("Error updating enrollment:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const deleteEnrollmentById = async (req, res) => {
  const enrollmentId = parseEnrollmentId(req.params.id);
  if (!enrollmentId) {
    return res.status(400).json({ message: "Invalid enrollment ID." });
  }

  try {
    const existingEnrollment = await getEnrollmentByIdRecord(enrollmentId);
    if (!existingEnrollment) {
      return res.status(404).json({ message: "Enrollment not found." });
    }

    if (
      req.user.role === "STUDENT" &&
      existingEnrollment.student_id !== req.user.id
    ) {
      return res
        .status(403)
        .json({ message: "Students can only delete their own enrollments." });
    }

    await deleteEnrollmentRecord(enrollmentId);
    return res.json({ message: "Enrollment deleted successfully." });
  } catch (error) {
    console.error("Error deleting enrollment:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const bulkEnrollment = async (req, res) => {
  const { course_id, students } = req.body;
  const courseId = parseCourseId(course_id);

  if (!courseId || !Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ message: "Valid course_id and students array are required." });
  }

  try {
    const course = await getCourseById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found." });
    }

    const password = await bcrypt.hash("Default123!", 10);

    const results = await prisma.$transaction(async (tx) => {
      const enrollments = [];
      for (const s of students) {
        let student = await findUserByStudentId(String(s.student_id));
        if (!student) {
          student = await createUser({
            name: s.name,
            email: `${s.student_id}@ppiu.edu.kh`,
            password,
            student_id: String(s.student_id),
            role: "STUDENT",
            date_of_birth: s.date_of_birth,
            address: "N/A",
            phone_number: String(s.phone_number),
          });
        }
        
        const existingEnrollment = await tx.enrollment.findUnique({
          where: {
            student_id_course_id: {
              student_id: student.id,
              course_id: courseId,
            }
          }
        });
        
        if (!existingEnrollment) {
           const enrollment = await tx.enrollment.create({
             data: { course_id: courseId, student_id: student.id },
           });
           enrollments.push(enrollment);
        }
      }
      return enrollments;
    });

    return res.status(201).json({ message: "Bulk enrollment completed.", count: results.length });
  } catch (error) {
    console.error("Error in bulk enrollment:", error);
    return res.status(500).json({ message: `Internal server error. ${error}` });
  }
};

module.exports = {
  allowedRoles,
  createEnrollment,
  listEnrollments,
  getEnrollmentById,
  updateEnrollment,
  deleteEnrollmentById,
  bulkEnrollment,
  parseEnrollmentId,
  getPagination,
  getEnrollmentsByCourse,
};

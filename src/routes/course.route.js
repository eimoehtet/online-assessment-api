const { Router } = require("express");
const {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
  getCourseByTeacherId,
  getCourseRoster,
  getStudentCourses,
  getStudentCourseQuizzes,
  toggleCourseStatusHandler,
} = require("../controllers/course.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRole = require("../middlewares/authorize-role.middleware");

const router = Router();

router.use(authMiddleware);

router.post("/", authorizeRole("ADMIN"), createCourse);
router.get("/", authorizeRole("ADMIN", "TEACHER", "STUDENT"), getCourses);
router.get("/student/mine", authorizeRole("STUDENT"), getStudentCourses);
router.get("/student/mine/:id/quizzes", authorizeRole("STUDENT"), getStudentCourseQuizzes);
router.get("/:id", authorizeRole("ADMIN", "TEACHER", "STUDENT"), getCourseById);
router.get("/teacher/:teacherId", authorizeRole("TEACHER"), getCourseByTeacherId);
router.get("/:id/students", authorizeRole("ADMIN", "TEACHER"), getCourseRoster);
router.patch("/:id", authorizeRole("ADMIN"), updateCourse);
router.delete("/:id", authorizeRole("ADMIN"), deleteCourse);
router.post("/:id/toggle-status", authorizeRole("ADMIN"), toggleCourseStatusHandler);

module.exports = router;

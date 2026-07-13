const { Router } = require("express");
const {
  createCourse,
  getCourses,
  getCourseById,
  updateCourse,
  deleteCourse,
} = require("../controllers/course.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRole = require("../middlewares/authorize-role.middleware");

const router = Router();

router.use(authMiddleware);

router.post("/", authorizeRole("ADMIN"), createCourse);
router.get("/", authorizeRole("ADMIN", "TEACHER", "STUDENT"), getCourses);
router.get("/:id", authorizeRole("ADMIN", "TEACHER", "STUDENT"), getCourseById);
router.patch("/:id", authorizeRole("ADMIN"), updateCourse);
router.delete("/:id", authorizeRole("ADMIN"), deleteCourse);

module.exports = router;

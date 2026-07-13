const { Router } = require("express");
const {
  createQuiz,
  listQuizzes,
  getQuizById,
  updateQuizById,
  deleteQuizById,
  createQuestion,
  listQuestionsByQuizId,
  getQuestionById,
  updateQuestionById,
  deleteQuestionById,
} = require("../controllers/quiz.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRole = require("../middlewares/authorize-role.middleware");

const router = Router();

router.use(authMiddleware);

router.post("/", authorizeRole("ADMIN", "TEACHER"), createQuiz);
router.get("/", authorizeRole("ADMIN", "TEACHER", "STUDENT"), listQuizzes);
router.get("/:id", authorizeRole("ADMIN", "TEACHER", "STUDENT"), getQuizById);
router.put("/:id", authorizeRole("ADMIN", "TEACHER"), updateQuizById);
router.delete("/:id", authorizeRole("ADMIN", "TEACHER"), deleteQuizById);

router.post("/:id/questions", authorizeRole("ADMIN", "TEACHER"), createQuestion);
router.get("/:id/questions", authorizeRole("ADMIN", "TEACHER", "STUDENT"), listQuestionsByQuizId);
router.get("/:id/questions/:questionId", authorizeRole("ADMIN", "TEACHER", "STUDENT"), getQuestionById);
router.patch("/:id/questions/:questionId", authorizeRole("ADMIN", "TEACHER"), updateQuestionById);
router.delete("/:id/questions/:questionId", authorizeRole("ADMIN", "TEACHER"), deleteQuestionById);

module.exports = router;

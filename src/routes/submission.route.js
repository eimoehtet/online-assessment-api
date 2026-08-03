const { Router } = require("express");
const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRole = require("../middlewares/authorize-role.middleware");
const {
  listSubmissionsHandler,
  startSubmission,
  finishSubmission,
  getSubmissionByIdHandler,
  deleteSubmissionByIdHandler,
  submitAnswer,
  listSubmissionAnswersHandler,
  getSubmissionAnswerByIdHandler,
  updateSubmissionAnswerByIdHandler,
  gradeSubmissionAnswerHandler,
  completeSubmissionReviewHandler,
  releaseSubmissionScoreHandler,
  deleteSubmissionAnswerByIdHandler,
  recordBehaviorLog,
  getSubmissionBehaviorSummary,
  getSubmissionBehaviorLogs,
  getBehaviorLogByIdHandler,
  deleteBehaviorLogByIdHandler,
  getSubmissionsByQuizIdHandler,
} = require("../controllers/submission.controller");

const router = Router();

router.use(authMiddleware);

router.get(
  "/",
  authorizeRole("ADMIN", "TEACHER", "STUDENT"),
  listSubmissionsHandler,
);
router.post("/", authorizeRole("STUDENT"), startSubmission);
router.post("/:id/submit", authorizeRole("STUDENT"), finishSubmission);
router.get(
  "/:id",
  authorizeRole("ADMIN", "TEACHER", "STUDENT"),
  getSubmissionByIdHandler,
);
router.delete(
  "/:id",
  authorizeRole("ADMIN", "TEACHER", "STUDENT"),
  deleteSubmissionByIdHandler,
);

router.post("/:id/answers", authorizeRole("STUDENT"), submitAnswer);
router.get(
  "/:id/answers",
  authorizeRole("ADMIN", "TEACHER", "STUDENT"),
  listSubmissionAnswersHandler,
);
router.get(
  "/:id/answers/:answerId",
  authorizeRole("ADMIN", "TEACHER", "STUDENT"),
  getSubmissionAnswerByIdHandler,
);
router.patch(
  "/:id/answers/:answerId",
  authorizeRole("ADMIN", "TEACHER", "STUDENT"),
  updateSubmissionAnswerByIdHandler,
);
router.patch(
  "/:id/answers/:answerId/grade",
  authorizeRole("ADMIN", "TEACHER"),
  gradeSubmissionAnswerHandler,
);
router.post(
  "/:id/complete-review",
  authorizeRole("ADMIN", "TEACHER"),
  completeSubmissionReviewHandler,
);
router.post(
  "/:id/release",
  authorizeRole("ADMIN", "TEACHER"),
  releaseSubmissionScoreHandler,
);
router.delete(
  "/:id/answers/:answerId",
  authorizeRole("ADMIN", "TEACHER", "STUDENT"),
  deleteSubmissionAnswerByIdHandler,
);

router.post("/:id/behavior-logs", authorizeRole("STUDENT"), recordBehaviorLog);
router.get(
  "/:id/behavior-summary",
  authorizeRole("ADMIN", "TEACHER", "STUDENT"),
  getSubmissionBehaviorSummary,
);
router.get(
  "/:id/behavior-logs",
  authorizeRole("ADMIN", "TEACHER", "STUDENT"),
  getSubmissionBehaviorLogs,
);
router.get(
  "/:id/behavior-logs/:logId",
  authorizeRole("ADMIN", "TEACHER", "STUDENT"),
  getBehaviorLogByIdHandler,
);
router.delete(
  "/:id/behavior-logs/:logId",
  authorizeRole("ADMIN", "TEACHER", "STUDENT"),
  deleteBehaviorLogByIdHandler,
);
router.get(
  "/quiz/:quizId",
  authorizeRole("ADMIN", "TEACHER"),
  getSubmissionsByQuizIdHandler,
);

module.exports = router;

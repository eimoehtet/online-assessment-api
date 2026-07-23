const {
  createSubmission,
  getSubmissionById,
  listSubmissions,
  deleteSubmissionById,
  assertStudentOwnership,
  upsertAnswer,
  listSubmissionAnswers,
  getSubmissionAnswerById,
  updateSubmissionAnswerById,
  deleteSubmissionAnswerById,
  createBehaviorLog,
  listBehaviorLogs,
  getBehaviorLogById,
  deleteBehaviorLogById,
  getBehaviorSummary,
  recalculateSubmissionTotalScore,
  submitSubmission,
  gradeSubmissionAnswer,
  completeSubmissionReview,
  releaseSubmissionScore,
} = require("../services/submission.service");

const allowedEventTypes = [
  "TAB_SWITCH",
  "COPY_ATTEMPT",
  "PASTE_ATTEMPT",
  "RAPID_ANSWER_CHANGE",
  "FULLSCREEN_EXIT",
  "TIME_SPENT_PER_Q",
];

const parsePositiveInt = (value) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const getPagination = (query) => {
  const page = Math.max(Number.parseInt(query.page || "1", 10), 1);
  const limit = Math.min(
    Math.max(Number.parseInt(query.limit || "20", 10), 1),
    100,
  );

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

const canViewSubmission = (user, submission) => {
  if (user.role === "ADMIN") {
    return true;
  }

  if (
    user.role === "TEACHER" &&
    submission.quiz?.course?.teacher_id === user.id
  ) {
    return true;
  }

  if (user.role === "STUDENT" && user.id === submission.student_id) {
    return true;
  }

  return false;
};

const canManageSubmission = (user, submission) => {
  if (user.role === "ADMIN") {
    return true;
  }

  if (
    user.role === "TEACHER" &&
    submission.quiz?.course?.teacher_id === user.id
  ) {
    return true;
  }

  if (user.role === "STUDENT" && user.id === submission.student_id) {
    return true;
  }

  return false;
};

const canReviewSubmission = (user, submission) =>
  user.role === "ADMIN" ||
  (user.role === "TEACHER" && submission.quiz?.course?.teacher_id === user.id);

const hideUnreleasedScores = (submission) => {
  if (submission.status === "RELEASED") return submission;
  const { total_score, auto_score, manual_score, feedback, answers, ...safeSubmission } = submission;
  return {
    ...safeSubmission,
    ...(answers ? { answers: hideUnreleasedAnswerScores(answers, false) } : {}),
  };
};

const hideUnreleasedAnswerScores = (answers, isReleased) => {
  if (isReleased) return answers;
  return answers.map(({ is_correct, points_awarded, teacher_points_awarded, teacher_feedback, ...answer }) => answer);
};

const listSubmissionsHandler = async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const quizId =
    req.query.quiz_id !== undefined
      ? parsePositiveInt(req.query.quiz_id)
      : undefined;
  const studentIdFromQuery =
    req.query.student_id !== undefined
      ? parsePositiveInt(req.query.student_id)
      : undefined;

  if (req.query.quiz_id !== undefined && !quizId) {
    return res.status(400).json({ message: "Invalid quiz_id filter." });
  }

  if (req.query.student_id !== undefined && !studentIdFromQuery) {
    return res.status(400).json({ message: "Invalid student_id filter." });
  }

  const studentId =
    req.user.role === "STUDENT" ? req.user.id : studentIdFromQuery;
  const teacherId = req.user.role === "TEACHER" ? req.user.id : undefined;

  try {
    const { items, total } = await listSubmissions({
      skip,
      take: limit,
      quiz_id: quizId,
      student_id: studentId,
      teacher_id: teacherId,
    });

    return res.status(200).json({
      data: req.user.role === "STUDENT" ? items.map(hideUnreleasedScores) : items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Error listing submissions:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const getSubmissionByIdHandler = async (req, res) => {
  const submissionId = parsePositiveInt(req.params.id);

  if (!submissionId) {
    return res.status(400).json({ message: "Invalid submission id." });
  }

  try {
    const submission = await getSubmissionById(submissionId);

    if (!submission) {
      return res.status(404).json({ message: "Submission not found." });
    }

    if (!canViewSubmission(req.user, submission)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.status(200).json(
      req.user.role === "STUDENT" ? hideUnreleasedScores(submission) : submission,
    );
  } catch (error) {
    console.error("Error fetching submission:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const deleteSubmissionByIdHandler = async (req, res) => {
  const submissionId = parsePositiveInt(req.params.id);

  if (!submissionId) {
    return res.status(400).json({ message: "Invalid submission id." });
  }

  try {
    const submission = await getSubmissionById(submissionId);

    if (!submission) {
      return res.status(404).json({ message: "Submission not found." });
    }

    if (!canManageSubmission(req.user, submission)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (req.user.role === "STUDENT" && submission.status !== "IN_PROGRESS") {
      return res.status(409).json({ message: "This submission has already been submitted and cannot be changed." });
    }

    await deleteSubmissionById(submissionId);
    return res.status(204).send();
  } catch (error) {
    console.error("Error deleting submission:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const startSubmission = async (req, res) => {
  const quiz_id = parsePositiveInt(req.body.quiz_id);

  if (!quiz_id) {
    return res.status(400).json({ message: "Valid quiz_id is required." });
  }

  try {
    const submission = await createSubmission({
      student_id: req.user.id,
      quiz_id,
    });

    return res.status(201).json(submission);
  } catch (error) {
    if (error.code === "QUIZ_NOT_FOUND") {
      return res.status(404).json({ message: error.message });
    }

    if (error.code === "QUIZ_NOT_PUBLISHED") {
      return res.status(409).json({ message: error.message });
    }

    if (error.code === "QUIZ_DEADLINE_PASSED") {
      return res.status(409).json({ message: error.message });
    }

    if (error.code === "NOT_ENROLLED") {
      return res.status(403).json({ message: error.message });
    }

    if (error.code === "ATTEMPT_LIMIT_REACHED") {
      return res.status(409).json({ message: error.message });
    }

    console.error("Error starting submission:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const submitAnswer = async (req, res) => {
  const submissionId = parsePositiveInt(req.params.id);
  const questionId = parsePositiveInt(req.body.question_id);
  const { student_answer = null } = req.body;

  if (!submissionId) {
    return res.status(400).json({ message: "Invalid submission id." });
  }

  if (!questionId) {
    return res.status(400).json({ message: "Valid question_id is required." });
  }

  try {
    const submission = await getSubmissionById(submissionId);

    if (!submission) {
      return res.status(404).json({ message: "Submission not found." });
    }

    assertStudentOwnership(submission, req.user.id);

    const answer = await upsertAnswer({
      submission_id: submissionId,
      question_id: questionId,
      student_answer,
    });

    await recalculateSubmissionTotalScore(submissionId);

    return res.status(200).json(answer);
  } catch (error) {
    if (error.code === "FORBIDDEN_SUBMISSION") {
      return res.status(403).json({ message: error.message });
    }

    if (error.code === "QUESTION_NOT_IN_QUIZ") {
      return res.status(400).json({ message: error.message });
    }

    if (error.code === "SUBMISSION_NOT_FOUND") {
      return res.status(404).json({ message: error.message });
    }

    if (error.code === "SUBMISSION_NOT_EDITABLE") {
      return res.status(409).json({ message: error.message });
    }

    console.error("Error submitting answer:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const finishSubmission = async (req, res) => {
  const submissionId = parsePositiveInt(req.params.id);
  if (!submissionId) return res.status(400).json({ message: "Invalid submission id." });
  try {
    const submission = await getSubmissionById(submissionId);
    if (!submission) return res.status(404).json({ message: "Submission not found." });
    assertStudentOwnership(submission, req.user.id);
    const completed = await submitSubmission({
      submission_id: submissionId,
      answers: req.body.answers,
    });
    return res.status(200).json(completed);
  } catch (error) {
    if (error.code === "FORBIDDEN_SUBMISSION") return res.status(403).json({ message: error.message });
    if (error.code === "SUBMISSION_NOT_EDITABLE") return res.status(409).json({ message: error.message });
    console.error("Error finishing submission:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const listSubmissionAnswersHandler = async (req, res) => {
  const submissionId = parsePositiveInt(req.params.id);

  if (!submissionId) {
    return res.status(400).json({ message: "Invalid submission id." });
  }

  try {
    const submission = await getSubmissionById(submissionId);

    if (!submission) {
      return res.status(404).json({ message: "Submission not found." });
    }

    if (!canViewSubmission(req.user, submission)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const answers = await listSubmissionAnswers({
      submission_id: submissionId,
    });
    return res.status(200).json(
      req.user.role === "STUDENT"
        ? hideUnreleasedAnswerScores(answers, submission.status === "RELEASED")
        : answers,
    );
  } catch (error) {
    console.error("Error listing submission answers:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const gradeSubmissionAnswerHandler = async (req, res) => {
  const submissionId = parsePositiveInt(req.params.id);
  const answerId = parsePositiveInt(req.params.answerId);
  const score = Number(req.body.teacher_points_awarded);
  if (!submissionId || !answerId || !Number.isInteger(score)) {
    return res.status(400).json({ message: "A whole-number teacher_points_awarded is required." });
  }
  try {
    const submission = await getSubmissionById(submissionId);
    if (!submission) return res.status(404).json({ message: "Submission not found." });
    if (!canReviewSubmission(req.user, submission)) return res.status(403).json({ message: "Forbidden" });
    const existingAnswer = await getSubmissionAnswerById(answerId);
    if (!existingAnswer || existingAnswer.submission_id !== submissionId) return res.status(404).json({ message: "Submission answer not found." });
    const answer = await gradeSubmissionAnswer({ answer_id: answerId, teacher_points_awarded: score, teacher_feedback: req.body.teacher_feedback });
    await recalculateSubmissionTotalScore(submissionId);
    return res.status(200).json(answer);
  } catch (error) {
    if (["INVALID_MANUAL_SCORE", "NOT_MANUAL_QUESTION"].includes(error.code)) return res.status(400).json({ message: error.message });
    if (error.code === "SUBMISSION_NOT_READY_FOR_REVIEW") return res.status(409).json({ message: error.message });
    console.error("Error grading answer:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const completeSubmissionReviewHandler = async (req, res) => {
  const submissionId = parsePositiveInt(req.params.id);
  if (!submissionId) return res.status(400).json({ message: "Invalid submission id." });
  try {
    const submission = await getSubmissionById(submissionId);
    if (!submission) return res.status(404).json({ message: "Submission not found." });
    if (!canReviewSubmission(req.user, submission)) return res.status(403).json({ message: "Forbidden" });
    const reviewed = await completeSubmissionReview({ submission_id: submissionId, reviewed_by: req.user.id, feedback: req.body.feedback });
    return res.status(200).json(reviewed);
  } catch (error) {
    if (["MANUAL_GRADING_INCOMPLETE", "SUBMISSION_NOT_READY_FOR_REVIEW"].includes(error.code)) return res.status(409).json({ message: error.message });
    console.error("Error completing review:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const releaseSubmissionScoreHandler = async (req, res) => {
  const submissionId = parsePositiveInt(req.params.id);
  if (!submissionId) return res.status(400).json({ message: "Invalid submission id." });
  try {
    const submission = await getSubmissionById(submissionId);
    if (!submission) return res.status(404).json({ message: "Submission not found." });
    if (!canReviewSubmission(req.user, submission)) return res.status(403).json({ message: "Forbidden" });
    return res.status(200).json(await releaseSubmissionScore(submissionId));
  } catch (error) {
    if (error.code === "SUBMISSION_NOT_GRADED") return res.status(409).json({ message: error.message });
    console.error("Error releasing score:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const getSubmissionAnswerByIdHandler = async (req, res) => {
  const submissionId = parsePositiveInt(req.params.id);
  const answerId = parsePositiveInt(req.params.answerId);

  if (!submissionId || !answerId) {
    return res
      .status(400)
      .json({ message: "Invalid submission id or answer id." });
  }

  try {
    const submission = await getSubmissionById(submissionId);

    if (!submission) {
      return res.status(404).json({ message: "Submission not found." });
    }

    if (!canViewSubmission(req.user, submission)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const answer = await getSubmissionAnswerById(answerId);
    if (!answer || answer.submission_id !== submissionId) {
      return res.status(404).json({ message: "Submission answer not found." });
    }

    return res.status(200).json(answer);
  } catch (error) {
    console.error("Error retrieving submission answer:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const updateSubmissionAnswerByIdHandler = async (req, res) => {
  const submissionId = parsePositiveInt(req.params.id);
  const answerId = parsePositiveInt(req.params.answerId);
  const studentAnswer = req.body.student_answer ?? null;

  if (!submissionId || !answerId) {
    return res
      .status(400)
      .json({ message: "Invalid submission id or answer id." });
  }

  try {
    const submission = await getSubmissionById(submissionId);

    if (!submission) {
      return res.status(404).json({ message: "Submission not found." });
    }

    if (!canManageSubmission(req.user, submission)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (req.user.role === "STUDENT" && submission.status !== "IN_PROGRESS") {
      return res.status(409).json({ message: "This submission has already been submitted and cannot be changed." });
    }

    const existingAnswer = await getSubmissionAnswerById(answerId);
    if (!existingAnswer || existingAnswer.submission_id !== submissionId) {
      return res.status(404).json({ message: "Submission answer not found." });
    }

    const updatedAnswer = await updateSubmissionAnswerById({
      id: answerId,
      student_answer: studentAnswer,
    });

    await recalculateSubmissionTotalScore(submissionId);

    return res.status(200).json(updatedAnswer);
  } catch (error) {
    if (error.code === "SUBMISSION_ANSWER_NOT_FOUND") {
      return res.status(404).json({ message: error.message });
    }

    if (error.code === "QUESTION_NOT_IN_QUIZ") {
      return res.status(400).json({ message: error.message });
    }

    console.error("Error updating submission answer:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const deleteSubmissionAnswerByIdHandler = async (req, res) => {
  const submissionId = parsePositiveInt(req.params.id);
  const answerId = parsePositiveInt(req.params.answerId);

  if (!submissionId || !answerId) {
    return res
      .status(400)
      .json({ message: "Invalid submission id or answer id." });
  }

  try {
    const submission = await getSubmissionById(submissionId);

    if (!submission) {
      return res.status(404).json({ message: "Submission not found." });
    }

    if (!canManageSubmission(req.user, submission)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    if (req.user.role === "STUDENT" && submission.status !== "IN_PROGRESS") {
      return res.status(409).json({ message: "This submission has already been submitted and cannot be changed." });
    }

    const existingAnswer = await getSubmissionAnswerById(answerId);
    if (!existingAnswer || existingAnswer.submission_id !== submissionId) {
      return res.status(404).json({ message: "Submission answer not found." });
    }

    await deleteSubmissionAnswerById(answerId);
    await recalculateSubmissionTotalScore(submissionId);

    return res.status(204).send();
  } catch (error) {
    console.error("Error deleting submission answer:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const recordBehaviorLog = async (req, res) => {
  const submissionId = parsePositiveInt(req.params.id);
  const questionId = parsePositiveInt(req.body.question_id);
  const eventType = req.body.event_type;
  const metadata = req.body.metadata;

  if (!submissionId) {
    return res.status(400).json({ message: "Invalid submission id." });
  }

  if (!questionId) {
    return res.status(400).json({ message: "Valid question_id is required." });
  }

  if (!eventType || !allowedEventTypes.includes(eventType)) {
    return res.status(400).json({
      message: "Valid event_type is required.",
      allowed_event_types: allowedEventTypes,
    });
  }

  try {
    const submission = await getSubmissionById(submissionId);

    if (!submission) {
      return res.status(404).json({ message: "Submission not found." });
    }

    assertStudentOwnership(submission, req.user.id);

    const log = await createBehaviorLog({
      submission_id: submissionId,
      question_id: questionId,
      event_type: eventType,
      metadata,
    });

    return res.status(201).json(log);
  } catch (error) {
    if (error.code === "FORBIDDEN_SUBMISSION") {
      return res.status(403).json({ message: error.message });
    }

    if (error.code === "QUESTION_NOT_IN_QUIZ") {
      return res.status(400).json({ message: error.message });
    }

    if (error.code === "SUBMISSION_NOT_FOUND") {
      return res.status(404).json({ message: error.message });
    }

    console.error("Error recording behavior log:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const getSubmissionBehaviorSummary = async (req, res) => {
  const submissionId = parsePositiveInt(req.params.id);

  if (!submissionId) {
    return res.status(400).json({ message: "Invalid submission id." });
  }

  try {
    const submission = await getSubmissionById(submissionId);

    if (!submission) {
      return res.status(404).json({ message: "Submission not found." });
    }

    if (!canViewSubmission(req.user, submission)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const summary = await getBehaviorSummary({ submission_id: submissionId });

    return res.status(200).json({
      submission_id: submissionId,
      student_id: submission.student_id,
      quiz_id: submission.quiz_id,
      ...summary,
    });
  } catch (error) {
    console.error("Error fetching behavior summary:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const getSubmissionBehaviorLogs = async (req, res) => {
  const submissionId = parsePositiveInt(req.params.id);

  if (!submissionId) {
    return res.status(400).json({ message: "Invalid submission id." });
  }

  const { page, limit, skip } = getPagination(req.query);

  try {
    const submission = await getSubmissionById(submissionId);

    if (!submission) {
      return res.status(404).json({ message: "Submission not found." });
    }

    if (!canViewSubmission(req.user, submission)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { items, total } = await listBehaviorLogs({
      submission_id: submissionId,
      skip,
      take: limit,
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
    console.error("Error fetching behavior logs:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const getBehaviorLogByIdHandler = async (req, res) => {
  const submissionId = parsePositiveInt(req.params.id);
  const logId = parsePositiveInt(req.params.logId);

  if (!submissionId || !logId) {
    return res
      .status(400)
      .json({ message: "Invalid submission id or log id." });
  }

  try {
    const submission = await getSubmissionById(submissionId);

    if (!submission) {
      return res.status(404).json({ message: "Submission not found." });
    }

    if (!canViewSubmission(req.user, submission)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const log = await getBehaviorLogById(logId);
    if (!log || log.submission_answer.submission_id !== submissionId) {
      return res.status(404).json({ message: "Behavior log not found." });
    }

    return res.status(200).json(log);
  } catch (error) {
    console.error("Error fetching behavior log:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const deleteBehaviorLogByIdHandler = async (req, res) => {
  const submissionId = parsePositiveInt(req.params.id);
  const logId = parsePositiveInt(req.params.logId);

  if (!submissionId || !logId) {
    return res
      .status(400)
      .json({ message: "Invalid submission id or log id." });
  }

  try {
    const submission = await getSubmissionById(submissionId);

    if (!submission) {
      return res.status(404).json({ message: "Submission not found." });
    }

    if (!canManageSubmission(req.user, submission)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const log = await getBehaviorLogById(logId);
    if (!log || log.submission_answer.submission_id !== submissionId) {
      return res.status(404).json({ message: "Behavior log not found." });
    }

    await deleteBehaviorLogById(logId);
    return res.status(204).send();
  } catch (error) {
    console.error("Error deleting behavior log:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

module.exports = {
  allowedEventTypes,
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
};

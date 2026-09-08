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
  releaseQuizScores,
  getSubmissionsByQuizId,
  getQuizSubmissionInsights,
} = require("../services/submission.service");
const { getPagination: getSharedPagination } = require("../utils/pagination");

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

const getPagination = (query) => getSharedPagination(query, 20);

const getQuizSubmissionInsightsHandler = async (req, res) => {
  const quizId = parsePositiveInt(req.params.quizId);
  if (!quizId) return res.status(400).json({ message: "Invalid quiz id." });
  try {
    const insights = await getQuizSubmissionInsights(quizId);
    if (!insights) return res.status(404).json({ message: "Quiz not found." });
    if (req.user.role !== "ADMIN" && insights.teacher_id !== req.user.id) return res.status(403).json({ message: "Forbidden" });
    const { teacher_id, ...response } = insights;
    return res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching quiz submission insights:", error);
    return res.status(500).json({ message: "Failed to fetch quiz insights." });
  }
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
  const { behaviorSummary, ...studentSubmission } = submission;
  if (submission.status === "RELEASED") return studentSubmission;
  const { total_score, auto_score, manual_score, current_score, percentage, feedback, answers, ...safeSubmission } = studentSubmission;
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
  const courseId = req.query.course_id !== undefined ? parsePositiveInt(req.query.course_id) : undefined;

  if (req.query.quiz_id !== undefined && !quizId) {
    return res.status(400).json({ message: "Invalid quiz_id filter." });
  }

  if (req.query.student_id !== undefined && !studentIdFromQuery) {
    return res.status(400).json({ message: "Invalid student_id filter." });
  }
  if (req.query.course_id !== undefined && !courseId) {
    return res.status(400).json({ message: "Invalid course_id filter." });
  }

  const allowedWorkflows = ["NEEDS_GRADING", "READY_TO_RELEASE", "RELEASED", "IN_PROGRESS", "COMPLETED", "AWAITING_REVIEW", "ALL"];
  const allowedRiskLevels = ["LOW", "MEDIUM", "HIGH"];
  const allowedSorts = ["submitted_at", "student", "score", "risk"];
  const workflow = req.query.workflow || "ALL";
  const riskLevel = req.user.role === "STUDENT" ? undefined : req.query.risk_level;
  const sort = req.query.sort || "submitted_at";
  const order = req.query.order === "asc" ? "asc" : "desc";
  if (!allowedWorkflows.includes(workflow)) return res.status(400).json({ message: "Invalid workflow filter." });
  if (riskLevel && !allowedRiskLevels.includes(riskLevel)) return res.status(400).json({ message: "Invalid risk_level filter." });
  if (!allowedSorts.includes(sort)) return res.status(400).json({ message: "Invalid sort option." });

  const parseDateFilter = (value, endOfDay = false) => {
    if (!value) return undefined;
    const date = new Date(endOfDay ? `${value}T23:59:59.999Z` : `${value}T00:00:00.000Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const submittedFrom = parseDateFilter(req.query.submitted_from);
  const submittedTo = parseDateFilter(req.query.submitted_to, true);
  if (submittedFrom === null || submittedTo === null) return res.status(400).json({ message: "Invalid submission date filter." });

  const studentId =
    req.user.role === "STUDENT" ? req.user.id : studentIdFromQuery;
  const teacherId = req.user.role === "TEACHER" ? req.user.id : undefined;

  try {
    const { items, total, summary } = await listSubmissions({
      skip,
      take: limit,
      quiz_id: quizId,
      course_id: courseId,
      student_id: studentId,
      teacher_id: teacherId,
      search: typeof req.query.search === "string" ? req.query.search.trim() : "",
      workflow,
      risk_level: riskLevel,
      submitted_from: submittedFrom,
      submitted_to: submittedTo,
      sort,
      order,
    });

    return res.status(200).json({
      data: req.user.role === "STUDENT" ? items.map(hideUnreleasedScores) : items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      summary: req.user.role === "STUDENT" ? {
        total: summary.total,
        awaiting_review: summary.awaiting_review,
        released: summary.released,
        released_average: summary.released_average,
        released_highest: summary.released_highest,
      } : summary,
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

    if (error.code === "QUIZ_NOT_STARTED") {
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

const releaseQuizScoresHandler = async (req, res) => {
  const quizId = parsePositiveInt(req.params.quizId);
  if (!quizId) return res.status(400).json({ message: "Invalid quiz id." });
  try {
    const result = await releaseQuizScores(quizId, req.user);
    return res.status(200).json({ released_count: result.count });
  } catch (error) {
    if ([403, 404].includes(error.status)) return res.status(error.status).json({ message: error.message });
    console.error("Error releasing quiz scores:", error);
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

const getSubmissionsByQuizIdHandler = async (req, res) => {
  const quizId = parsePositiveInt(req.params.quizId);
  if (!quizId) {
    return res.status(400).json({ message: "Invalid quiz ID." });
  }

  const { page, limit, skip } = getPagination(req.query);

  try {
    const submissions = await getSubmissionsByQuizId(quizId, { skip, take: limit });
    return res.status(200).json({
      data: submissions.items,
      meta: {
        page,
        limit,
        total: submissions.total,
        totalPages: Math.ceil(submissions.total / limit),
      },
    });
  } catch (error) {
    console.error("Error fetching submissions by quiz ID:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

module.exports = {
  allowedEventTypes,
  canReviewSubmission,
  hideUnreleasedScores,
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
  releaseQuizScoresHandler,
  deleteSubmissionAnswerByIdHandler,
  recordBehaviorLog,
  getSubmissionBehaviorSummary,
  getSubmissionBehaviorLogs,
  getBehaviorLogByIdHandler,
  deleteBehaviorLogByIdHandler,
  getSubmissionsByQuizIdHandler,
  getQuizSubmissionInsightsHandler,
};

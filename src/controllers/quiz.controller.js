const {
  createQuiz: createQuizRecord,
  listQuizzes: listQuizRecords,
  getQuizById: getQuizByIdRecord,
  updateQuizById: updateQuizByIdRecord,
  deleteQuizById: deleteQuizByIdRecord,
  createQuestion: createQuestionRecord,
  listQuestionsByQuizId: listQuestionsByQuizIdRecord,
  getQuestionById: getQuestionByIdRecord,
  updateQuestionById: updateQuestionByIdRecord,
  deleteQuestionById: deleteQuestionByIdRecord,
  getQuizzesByTeacherId: getQuizzesByTeacherIdRecord,
  getStudentsByQuizIdAndTeacherId: getStudentsByQuizIdAndTeacherIdRecord,
  getAllQuizzesReportByAdmin: getAllQuizzesReportByAdminRecord,
} = require("../services/quiz.service");
const { getCourseById } = require("../services/course.service");
const { getPagination, paginationMeta } = require("../utils/pagination");

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

  if (combined.includes("title")) {
    return "Quiz title already in use.";
  }

  return "Duplicate value already exists.";
};

const parseQuizId = (value) => {
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

const normalizeQuizTiming = (body, { requireEndDate = false } = {}) => {
  const data = { ...body };

  if (requireEndDate || body.end_date !== undefined) {
    const endDate = new Date(body.end_date);
    if (!body.end_date || Number.isNaN(endDate.getTime())) {
      return { error: "A valid end_date is required." };
    }
    data.end_date = endDate;
  }

  if (body.time_limit !== undefined) {
    if (body.time_limit === null || body.time_limit === "") {
      data.time_limit = null;
    } else {
      const timeLimit = Number(body.time_limit);
      if (!Number.isInteger(timeLimit) || timeLimit <= 0) {
        return { error: "time_limit must be a positive number of minutes or null." };
      }
      data.time_limit = timeLimit;
    }
  }

  return { data };
};

const questionTypes = ["MCQ", "TRUE_FALSE", "SHORT_Q", "LONG_Q"];

const parseQuestionId = (value) => {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const parseOptionalNonNegativeInt = (value) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
};

const normalizeOptions = (options) => {
  if (!Array.isArray(options)) {
    return null;
  }

  const normalized = [];
  const orders = new Set();

  for (let index = 0; index < options.length; index += 1) {
    const option = options[index] || {};
    const optionText = String(option.option_text || "").trim();

    if (!optionText) {
      return null;
    }

    const rawOrder = option.option_order ?? index + 1;
    const optionOrder = Number(rawOrder);

    if (!Number.isInteger(optionOrder) || optionOrder <= 0) {
      return null;
    }

    if (orders.has(optionOrder)) {
      return null;
    }
    orders.add(optionOrder);

    normalized.push({
      option_text: optionText,
      is_correct: Boolean(option.is_correct),
      option_order: optionOrder,
    });
  }

  return normalized;
};

const validateQuestionPayload = ({
  payload,
  isPatch = false,
  existingQuestion = null,
}) => {
  const questionType = payload.question_type ?? existingQuestion?.question_type;
  const questionText =
    payload.question_text !== undefined
      ? String(payload.question_text || "").trim()
      : existingQuestion?.question_text;
  const questionOrder =
    payload.question_order !== undefined
      ? Number(payload.question_order)
      : existingQuestion?.question_order;
  const points =
    payload.points !== undefined
      ? parseOptionalNonNegativeInt(payload.points)
      : existingQuestion?.points;
  const correctAnswer =
    payload.correct_answer !== undefined
      ? payload.correct_answer === null
        ? null
        : String(payload.correct_answer).trim()
      : existingQuestion?.correct_answer;

  let options = null;
  if (payload.options !== undefined) {
    options = normalizeOptions(payload.options);
    if (!options) {
      return {
        ok: false,
        message:
          "Invalid options. Each option needs option_text, unique positive option_order, and optional is_correct.",
      };
    }
  } else if (!isPatch) {
    options = [];
  }

  if (!questionType || !questionTypes.includes(questionType)) {
    return {
      ok: false,
      message: "Invalid question_type.",
    };
  }

  if (!questionText) {
    return {
      ok: false,
      message: "question_text is required.",
    };
  }

  if (!Number.isInteger(questionOrder) || questionOrder <= 0) {
    return {
      ok: false,
      message: "question_order must be a positive integer.",
    };
  }

  if (points === null) {
    return {
      ok: false,
      message: "points must be a non-negative integer.",
    };
  }

  const effectiveOptions =
    options ??
    (existingQuestion?.options
      ? normalizeOptions(existingQuestion.options)
      : []);

  if (questionType === "MCQ" || questionType === "TRUE_FALSE") {
    if (!effectiveOptions || effectiveOptions.length < 2) {
      return {
        ok: false,
        message: "MCQ and TRUE_FALSE require at least 2 options.",
      };
    }

    if (questionType === "TRUE_FALSE" && effectiveOptions.length !== 2) {
      return {
        ok: false,
        message: "TRUE_FALSE requires exactly 2 options.",
      };
    }

    const correctCount = effectiveOptions.filter(
      (opt) => opt.is_correct,
    ).length;
    if (correctCount < 1) {
      return {
        ok: false,
        message: "At least one option must be marked as correct.",
      };
    }

    if (correctAnswer && String(correctAnswer).trim()) {
      return {
        ok: false,
        message:
          "correct_answer should be null for MCQ and TRUE_FALSE because correctness comes from options.",
      };
    }
  }

  return {
    ok: true,
    value: {
      question_type: questionType,
      question_text: questionText,
      question_order: questionOrder,
      points,
      correct_answer: correctAnswer || null,
      options: effectiveOptions || [],
    },
  };
};

const createQuiz = async (req, res) => {
  const courseId = parseCourseId(req.body.course_id);

  if (!courseId) {
    return res.status(400).json({ message: "Valid course_id is required." });
  }

  const timing = normalizeQuizTiming(req.body, { requireEndDate: true });
  if (timing.error) {
    return res.status(400).json({ message: timing.error });
  }

  try {
    const course = await getCourseById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found." });
    }

    const quiz = await createQuizRecord({
      ...timing.data,
      course_id: courseId,
    });
    return res.status(201).json(quiz);
  } catch (error) {
    if (error.code === "P2002") {
      const message = getUniqueConflictMessage(error);
      return res.status(409).json({ message });
    }

    console.error("Error creating quiz:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const listQuizzes = async (req, res) => {
  const { page, skip, limit } = getPagination(req.query);
  const courseId =
    req.query.course_id !== undefined
      ? parseCourseId(req.query.course_id)
      : undefined;

  if (req.query.course_id !== undefined && !courseId) {
    return res.status(400).json({ message: "Invalid course_id filter." });
  }

  try {
    const { items, total } = await listQuizRecords({
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
    console.error("Error listing quizzes:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const getQuizzesByTeacherId = async (req, res) => {
  const teacherId = req.user?.id;

  if (!teacherId) {
    return res.status(400).json({ message: "Teacher ID is required." });
  }

  try {
    const { page, skip, limit } = getPagination(req.query);
    const { items, total } = await getQuizzesByTeacherIdRecord(teacherId, { skip, take: limit });

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
    console.error("Error listing quizzes for teacher:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const getQuizById = async (req, res) => {
  const id = parseQuizId(req.params.id);

  if (!id) {
    return res.status(400).json({ message: "Invalid quiz ID." });
  }

  try {
    const quiz = await getQuizByIdRecord(id);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found." });
    }
    return res.json(quiz);
  } catch (error) {
    console.error("Error retrieving quiz:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const updateQuizById = async (req, res) => {
  const id = parseQuizId(req.params.id);

  if (!id) {
    return res.status(400).json({ message: "Invalid quiz ID." });
  }

  const timing = normalizeQuizTiming(req.body);
  if (timing.error) {
    return res.status(400).json({ message: timing.error });
  }

  try {
    const existingQuiz = await getQuizByIdRecord(id);
    if (!existingQuiz) {
      return res.status(404).json({ message: "Quiz not found." });
    }

    if (req.body.course_id !== undefined) {
      const courseId = parseCourseId(req.body.course_id);
      if (!courseId) {
        return res.status(400).json({ message: "Invalid course_id." });
      }

      const course = await getCourseById(courseId);
      if (!course) {
        return res.status(404).json({ message: "Course not found." });
      }

      timing.data.course_id = courseId;
    }

    const updatedQuiz = await updateQuizByIdRecord(id, timing.data);
    return res.json(updatedQuiz);
  } catch (error) {
    if (error.code === "P2002") {
      const message = getUniqueConflictMessage(error);
      return res.status(409).json({ message });
    }

    console.error("Error updating quiz:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const deleteQuizById = async (req, res) => {
  const id = parseQuizId(req.params.id);

  if (!id) {
    return res.status(400).json({ message: "Invalid quiz ID." });
  }

  try {
    const existingQuiz = await getQuizByIdRecord(id);
    if (!existingQuiz) {
      return res.status(404).json({ message: "Quiz not found." });
    }

    await deleteQuizByIdRecord(id);
    return res.status(204).send();
  } catch (error) {
    console.error("Error deleting quiz:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const createQuestion = async (req, res) => {
  const quizId = parseQuizId(req.params.id);

  if (!quizId) {
    return res.status(400).json({ message: "Invalid quiz ID." });
  }

  try {
    const quiz = await getQuizByIdRecord(quizId);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found." });
    }

    const validation = validateQuestionPayload({ payload: req.body });
    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }

    const { options, ...questionData } = validation.value;
    const question = await createQuestionRecord({
      quiz_id: quizId,
      data: questionData,
      options,
    });

    return res.status(201).json(question);
  } catch (error) {
    if (error.code === "P2002") {
      const message = getUniqueConflictMessage(error);
      return res.status(409).json({ message });
    }

    console.error("Error creating question:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const listQuestionsByQuizId = async (req, res) => {
  const quizId = parseQuizId(req.params.id);

  if (!quizId) {
    return res.status(400).json({ message: "Invalid quiz ID." });
  }

  try {
    const quiz = await getQuizByIdRecord(quizId);
    if (!quiz) {
      return res.status(404).json({ message: "Quiz not found." });
    }

    const questions = await listQuestionsByQuizIdRecord(quizId);
    return res.status(200).json(questions);
  } catch (error) {
    console.error("Error listing questions:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const getQuestionById = async (req, res) => {
  const quizId = parseQuizId(req.params.id);
  const questionId = parseQuestionId(req.params.questionId);

  if (!quizId || !questionId) {
    return res.status(400).json({ message: "Invalid quiz ID or question ID." });
  }

  try {
    const question = await getQuestionByIdRecord(questionId);
    if (!question || question.quiz_id !== quizId) {
      return res.status(404).json({ message: "Question not found." });
    }

    return res.status(200).json(question);
  } catch (error) {
    console.error("Error retrieving question:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const updateQuestionById = async (req, res) => {
  const quizId = parseQuizId(req.params.id);
  const questionId = parseQuestionId(req.params.questionId);

  if (!quizId || !questionId) {
    return res.status(400).json({ message: "Invalid quiz ID or question ID." });
  }

  try {
    const existingQuestion = await getQuestionByIdRecord(questionId);
    if (!existingQuestion || existingQuestion.quiz_id !== quizId) {
      return res.status(404).json({ message: "Question not found." });
    }

    const validation = validateQuestionPayload({
      payload: req.body,
      isPatch: true,
      existingQuestion,
    });
    if (!validation.ok) {
      return res.status(400).json({ message: validation.message });
    }

    const { options, ...validatedData } = validation.value;
    const dataToUpdate = {};
    const allowedFields = [
      "question_type",
      "question_text",
      "question_order",
      "points",
      "correct_answer",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        dataToUpdate[field] = validatedData[field];
      }
    }

    const updatedQuestion = await updateQuestionByIdRecord({
      id: questionId,
      data: dataToUpdate,
      options: req.body.options !== undefined ? options : undefined,
    });

    return res.status(200).json(updatedQuestion);
  } catch (error) {
    if (error.code === "P2002") {
      const message = getUniqueConflictMessage(error);
      return res.status(409).json({ message });
    }

    console.error("Error updating question:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const deleteQuestionById = async (req, res) => {
  const quizId = parseQuizId(req.params.id);
  const questionId = parseQuestionId(req.params.questionId);

  if (!quizId || !questionId) {
    return res.status(400).json({ message: "Invalid quiz ID or question ID." });
  }

  try {
    const existingQuestion = await getQuestionByIdRecord(questionId);
    if (!existingQuestion || existingQuestion.quiz_id !== quizId) {
      return res.status(404).json({ message: "Question not found." });
    }

    await deleteQuestionByIdRecord(questionId);
    return res.status(204).send();
  } catch (error) {
    console.error("Error deleting question:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const getStudentsByQuizIdAndTeacherId = async (req, res) => {
  const quizId = parseQuizId(req.params.id);
  if (!quizId) {
    return res.status(400).json({ message: "Invalid quiz ID." });
  }

  const teacherId = parseQuizId(req.params.teacherId);
  if (!teacherId || teacherId !== req.user.id) {
    return res.status(403).json({ message: "Teachers can only view students for their own quizzes." });
  }

  const { page, skip, limit } = getPagination(req.query);

  try {
    const { items, total } = await getStudentsByQuizIdAndTeacherIdRecord(quizId, teacherId, { skip, take: limit });
    return res.status(200).json({
      data: items,
      meta: paginationMeta({ page, limit, total }),
    });
  } catch (error) {
    console.error("Error fetching students by quiz ID and teacher ID:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

const getAllQuizzesReportByAdmin = async (req, res) => {
  try {
    const { page, skip, limit } = getPagination(req.query);

    const { items, total } = await getAllQuizzesReportByAdminRecord({ skip, take: limit });

    return res.status(200).json({
      data: items,
      meta: paginationMeta({ page, limit, total }),
    });
  } catch (error) {
    console.error("Error fetching quizzes report by admin:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

module.exports = {
  allowedRoles,
  getUniqueConflictMessage,
  parseQuizId,
  parseCourseId,
  parseQuestionId,
  getPagination,
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
  getQuizzesByTeacherId,
  getStudentsByQuizIdAndTeacherId,
  getAllQuizzesReportByAdmin,
};

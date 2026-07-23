const prisma = require("../config/prisma");

const eventRiskWeights = {
  TAB_SWITCH: 2,
  COPY_ATTEMPT: 5,
  PASTE_ATTEMPT: 4,
  RAPID_ANSWER_CHANGE: 3,
  FULLSCREEN_EXIT: 4,
  TIME_SPENT_PER_Q: 0,
};

const submissionPublicInclude = {
  quiz: {
    select: {
      id: true,
      title: true,
      status: true,
      course: {
        select: {
          id: true,
          name: true,
          code: true,
          teacher_id: true,
        },
      },
    },
  },
  student: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },
  _count: {
    select: {
      answers: true,
    },
  },
};

const normalizeText = (value) => {
  return String(value || "")
    .trim()
    .toLowerCase();
};

const parseAnswerTokens = (value) => {
  if (value === null || value === undefined) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean).sort();
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return [];
    }

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map(normalizeText).filter(Boolean).sort();
        }
      } catch (_error) {
        console.log("Failed to parse answer tokens as JSON array, falling back to comma-separated parsing.");  
      }
    }

    return trimmed.split(",").map(normalizeText).filter(Boolean).sort();
  }

  return [normalizeText(value)].filter(Boolean);
};

const compareAnswerSets = (left, right) => {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false;
    }
  }

  return true;
};

const evaluateAnswer = (question, studentAnswer) => {
  const questionPoints = question.points ?? 0;

  if (
    question.question_type === "SHORT_Q" ||
    question.question_type === "LONG_Q"
  ) {
    return {
      is_correct: null,
      points_awarded: null,
    };
  }

  const correctOptionTexts = question.options
    .filter((option) => option.is_correct)
    .map((option) => option.option_text)
    .map(normalizeText)
    .filter(Boolean)
    .sort();

  const studentAnswers = parseAnswerTokens(studentAnswer);
  const isCorrect = compareAnswerSets(correctOptionTexts, studentAnswers);

  return {
    is_correct: isCorrect,
    points_awarded: isCorrect ? questionPoints : 0,
  };
};

const getQuizForAttempt = async (quizId) => {
  return prisma.quiz.findUnique({
    where: { id: quizId },
    select: {
      id: true,
      course_id: true,
      status: true,
      time_limit: true,
      allowed_attempts: true,
    },
  });
};

const checkEnrollment = async ({ student_id, course_id }) => {
  return prisma.enrollment.findUnique({
    where: {
      student_id_course_id: {
        student_id,
        course_id,
      },
    },
    select: { id: true },
  });
};

const createSubmission = async ({ student_id, quiz_id }) => {
  const quiz = await getQuizForAttempt(quiz_id);

  if (!quiz) {
    const error = new Error("Quiz not found.");
    error.code = "QUIZ_NOT_FOUND";
    throw error;
  }

  if (quiz.status !== "PUBLISHED") {
    const error = new Error("Quiz is not available yet.");
    error.code = "QUIZ_NOT_PUBLISHED";
    throw error;
  }

  if (quiz.time_limit <= new Date()) {
    const error = new Error("Quiz deadline has passed.");
    error.code = "QUIZ_DEADLINE_PASSED";
    throw error;
  }

  const enrollment = await checkEnrollment({
    student_id,
    course_id: quiz.course_id,
  });

  if (!enrollment) {
    const error = new Error("Student is not enrolled in this course.");
    error.code = "NOT_ENROLLED";
    throw error;
  }

  return prisma.submission.create({
    data: {
      student_id,
      quiz_id,
    },
    include: {
      quiz: {
        select: {
          id: true,
          title: true,
          allowed_attempts: true,
        },
      },
    },
  });
};

const assertSubmissionEditable = (submission) => {
  if (submission.status !== "IN_PROGRESS") {
    const error = new Error("This submission has already been submitted and cannot be changed.");
    error.code = "SUBMISSION_NOT_EDITABLE";
    throw error;
  }
};

const getSubmissionById = async (id) => {
  return prisma.submission.findUnique({
    where: { id },
    include: {
      quiz: {
        select: {
          id: true,
          title: true,
          course: {
            select: {
              id: true,
              teacher_id: true,
            },
          },
        },
      },
      answers: {
        include: {
          question: {
            select: {
              id: true,
              question_text: true,
              question_type: true,
            },
          },
        },
      },
    },
  });
};

const listSubmissions = async ({ skip, take, student_id, quiz_id, teacher_id }) => {
  const where = {};

  if (student_id !== undefined) {
    where.student_id = student_id;
  }

  if (quiz_id !== undefined) {
    where.quiz_id = quiz_id;
  }

  if (teacher_id !== undefined) {
    where.quiz = {
      course: {
        teacher_id,
      },
    };
  }

  const [items, total] = await Promise.all([
    prisma.submission.findMany({
      where,
      skip,
      take,
      orderBy: { id: "desc" },
      include: submissionPublicInclude,
    }),
    prisma.submission.count({ where }),
  ]);

  return { items, total };
};

const deleteSubmissionById = async (id) => {
  return prisma.submission.delete({
    where: { id },
  });
};

const assertStudentOwnership = (submission, studentId) => {
  if (submission.student_id !== studentId) {
    const error = new Error("You do not have access to this submission.");
    error.code = "FORBIDDEN_SUBMISSION";
    throw error;
  }
};

const getQuestionForSubmission = async ({ quiz_id, question_id }) => {
  return prisma.question.findFirst({
    where: {
      id: question_id,
      quiz_id,
    },
    include: {
      options: {
        select: {
          option_text: true,
          is_correct: true,
        },
      },
    },
  });
};

const upsertAnswer = async ({ submission_id, question_id, student_answer }) => {
  const submission = await prisma.submission.findUnique({
    where: { id: submission_id },
    select: {
      id: true,
      quiz_id: true,
      status: true,
    },
  });

  if (!submission) {
    const error = new Error("Submission not found.");
    error.code = "SUBMISSION_NOT_FOUND";
    throw error;
  }

  assertSubmissionEditable(submission);

  const question = await getQuestionForSubmission({
    quiz_id: submission.quiz_id,
    question_id,
  });

  if (!question) {
    const error = new Error("Question not found in this quiz.");
    error.code = "QUESTION_NOT_IN_QUIZ";
    throw error;
  }

  const grading = evaluateAnswer(question, student_answer);

  const answer = await prisma.submissionAnswer.upsert({
    where: {
      submission_id_question_id: {
        submission_id,
        question_id,
      },
    },
    update: {
      student_answer,
      is_correct: grading.is_correct,
      points_awarded: grading.points_awarded,
    },
    create: {
      submission_id,
      question_id,
      student_answer,
      is_correct: grading.is_correct,
      points_awarded: grading.points_awarded,
    },
    include: {
      question: {
        select: {
          id: true,
          question_text: true,
          question_type: true,
          points: true,
        },
      },
    },
  });

  return answer;
};

const ensureSubmissionAnswer = async ({ submission_id, question_id }) => {
  return prisma.submissionAnswer.upsert({
    where: {
      submission_id_question_id: {
        submission_id,
        question_id,
      },
    },
    update: {},
    create: {
      submission_id,
      question_id,
      student_answer: null,
      is_correct: null,
      points_awarded: null,
    },
    select: {
      id: true,
    },
  });
};

const listSubmissionAnswers = async ({ submission_id }) => {
  return prisma.submissionAnswer.findMany({
    where: { submission_id },
    orderBy: { id: "asc" },
    include: {
      question: {
        select: {
          id: true,
          question_text: true,
          question_type: true,
          points: true,
        },
      },
    },
  });
};

const getSubmissionAnswerById = async (id) => {
  return prisma.submissionAnswer.findUnique({
    where: { id },
    include: {
      question: {
        select: {
          id: true,
          question_text: true,
          question_type: true,
          points: true,
        },
      },
      behaviorLogs: true,
    },
  });
};

const updateSubmissionAnswerById = async ({ id, student_answer }) => {
  const existing = await prisma.submissionAnswer.findUnique({
    where: { id },
    select: {
      submission_id: true,
      question_id: true,
    },
  });

  if (!existing) {
    const error = new Error("Submission answer not found.");
    error.code = "SUBMISSION_ANSWER_NOT_FOUND";
    throw error;
  }

  return upsertAnswer({
    submission_id: existing.submission_id,
    question_id: existing.question_id,
    student_answer,
  });
};

const deleteSubmissionAnswerById = async (id) => {
  return prisma.submissionAnswer.delete({
    where: { id },
  });
};

const createBehaviorLog = async ({
  submission_id,
  question_id,
  event_type,
  metadata,
}) => {
  const submission = await prisma.submission.findUnique({
    where: { id: submission_id },
    select: {
      id: true,
      quiz_id: true,
    },
  });

  if (!submission) {
    const error = new Error("Submission not found.");
    error.code = "SUBMISSION_NOT_FOUND";
    throw error;
  }

  const question = await getQuestionForSubmission({
    quiz_id: submission.quiz_id,
    question_id,
  });

  if (!question) {
    const error = new Error("Question not found in this quiz.");
    error.code = "QUESTION_NOT_IN_QUIZ";
    throw error;
  }

  const answer = await ensureSubmissionAnswer({ submission_id, question_id });

  return prisma.behaviorLog.create({
    data: {
      submission_answer_id: answer.id,
      event_type,
      metadata: metadata ?? null,
    },
  });
};

const listBehaviorLogs = async ({ submission_id, skip, take }) => {
  const where = {
    submission_answer: {
      submission_id,
    },
  };

  const [items, total] = await Promise.all([
    prisma.behaviorLog.findMany({
      where,
      skip,
      take,
      orderBy: { timestamp: "desc" },
      include: {
        submission_answer: {
          select: {
            question_id: true,
          },
        },
      },
    }),
    prisma.behaviorLog.count({ where }),
  ]);

  return { items, total };
};

const getBehaviorLogById = async (id) => {
  return prisma.behaviorLog.findUnique({
    where: { id },
    include: {
      submission_answer: {
        select: {
          id: true,
          submission_id: true,
          question_id: true,
        },
      },
    },
  });
};

const deleteBehaviorLogById = async (id) => {
  return prisma.behaviorLog.delete({
    where: { id },
  });
};

const getBehaviorSummary = async ({ submission_id }) => {
  const grouped = await prisma.behaviorLog.groupBy({
    by: ["event_type"],
    where: {
      submission_answer: {
        submission_id,
      },
    },
    _count: {
      _all: true,
    },
  });

  const counts = grouped.reduce((accumulator, item) => {
    accumulator[item.event_type] = item._count._all;
    return accumulator;
  }, {});

  const totalEvents = Object.values(counts).reduce(
    (sum, value) => sum + value,
    0,
  );

  const riskScore = Object.entries(counts).reduce(
    (score, [eventType, count]) =>
      score + (eventRiskWeights[eventType] || 0) * Number(count),
    0,
  );

  let riskLevel = "LOW";
  if (riskScore >= 20) {
    riskLevel = "HIGH";
  } else if (riskScore >= 10) {
    riskLevel = "MEDIUM";
  }

  return {
    total_events: totalEvents,
    event_counts: counts,
    risk_score: riskScore,
    risk_level: riskLevel,
  };
};

const recalculateSubmissionTotalScore = async (submission_id) => {
  const [automatic, manual] = await Promise.all([
    prisma.submissionAnswer.aggregate({
      where: { submission_id, question: { question_type: { in: ["MCQ", "TRUE_FALSE"] } } },
      _sum: { points_awarded: true },
    }),
    prisma.submissionAnswer.aggregate({
      where: { submission_id, question: { question_type: { in: ["SHORT_Q", "LONG_Q"] } } },
      _sum: { teacher_points_awarded: true },
    }),
  ]);

  return prisma.submission.update({
    where: { id: submission_id },
    data: {
      auto_score: automatic._sum.points_awarded || 0,
      manual_score: manual._sum.teacher_points_awarded || 0,
    },
  });
};

const submitSubmission = async ({ submission_id, answers = [] }) => {
  const submission = await prisma.submission.findUnique({
    where: { id: submission_id },
    select: { id: true, quiz_id: true, status: true },
  });

  if (!submission) {
    const error = new Error("Submission not found.");
    error.code = "SUBMISSION_NOT_FOUND";
    throw error;
  }
  assertSubmissionEditable(submission);
  const questions = await prisma.question.findMany({
    where: { quiz_id: submission.quiz_id },
    include: { options: { select: { option_text: true, is_correct: true } } },
  });
  const submittedAnswers = new Map(
    Array.isArray(answers)
      ? answers
          .filter((answer) => Number.isInteger(Number(answer.question_id)))
          .map((answer) => [Number(answer.question_id), answer.student_answer ?? null])
      : [],
  );
  await prisma.$transaction(
    questions.map((question) => {
      const hasFinalAnswer = submittedAnswers.has(question.id);
      const student_answer = submittedAnswers.get(question.id);
      const grading = hasFinalAnswer ? evaluateAnswer(question, student_answer) : null;
      return prisma.submissionAnswer.upsert({
        where: { submission_id_question_id: { submission_id, question_id: question.id } },
        update: hasFinalAnswer
          ? { student_answer, is_correct: grading.is_correct, points_awarded: grading.points_awarded }
          : {},
        create: {
          submission_id,
          question_id: question.id,
          student_answer: hasFinalAnswer ? student_answer : null,
          is_correct: grading?.is_correct ?? null,
          points_awarded: grading?.points_awarded ?? null,
        },
      });
    }),
  );
  await recalculateSubmissionTotalScore(submission_id);
  return prisma.submission.update({
    where: { id: submission_id },
    data: { status: "SUBMITTED", completed_at: new Date(), total_score: null },
  });
};

const gradeSubmissionAnswer = async ({ answer_id, teacher_points_awarded, teacher_feedback }) => {
  const answer = await prisma.submissionAnswer.findUnique({
    where: { id: answer_id },
    include: { question: { select: { points: true, question_type: true } }, submission: { select: { status: true } } },
  });
  if (!answer) {
    const error = new Error("Submission answer not found.");
    error.code = "SUBMISSION_ANSWER_NOT_FOUND";
    throw error;
  }
  if (!["SUBMITTED", "IN_REVIEW", "GRADED"].includes(answer.submission.status)) {
    const error = new Error("This submission is not ready for review.");
    error.code = "SUBMISSION_NOT_READY_FOR_REVIEW";
    throw error;
  }
  if (!["SHORT_Q", "LONG_Q"].includes(answer.question.question_type)) {
    const error = new Error("Only written answers require manual grading.");
    error.code = "NOT_MANUAL_QUESTION";
    throw error;
  }
  if (!Number.isInteger(teacher_points_awarded) || teacher_points_awarded < 0 || teacher_points_awarded > (answer.question.points || 0)) {
    const error = new Error(`Score must be a whole number between 0 and ${answer.question.points || 0}.`);
    error.code = "INVALID_MANUAL_SCORE";
    throw error;
  }
  return prisma.submissionAnswer.update({
    where: { id: answer_id },
    data: { teacher_points_awarded, teacher_feedback: teacher_feedback ?? null },
    include: { question: { select: { id: true, question_text: true, question_type: true, points: true } } },
  });
};

const completeSubmissionReview = async ({ submission_id, reviewed_by, feedback }) => {
  const submission = await prisma.submission.findUnique({ where: { id: submission_id }, select: { status: true } });
  if (!submission || !["SUBMITTED", "IN_REVIEW", "GRADED"].includes(submission.status)) {
    const error = new Error("This submission is not ready for review.");
    error.code = "SUBMISSION_NOT_READY_FOR_REVIEW";
    throw error;
  }
  const ungraded = await prisma.submissionAnswer.count({
    where: { submission_id, question: { question_type: { in: ["SHORT_Q", "LONG_Q"] } }, teacher_points_awarded: null },
  });
  if (ungraded > 0) {
    const error = new Error("Every short and long answer must receive a score before completing review.");
    error.code = "MANUAL_GRADING_INCOMPLETE";
    throw error;
  }
  const scores = await recalculateSubmissionTotalScore(submission_id);
  return prisma.submission.update({
    where: { id: submission_id },
    data: {
      status: "GRADED",
      total_score: scores.auto_score + scores.manual_score,
      reviewed_by,
      reviewed_at: new Date(),
      feedback: feedback ?? null,
    },
  });
};

const releaseSubmissionScore = async (submission_id) => {
  const submission = await prisma.submission.findUnique({ where: { id: submission_id }, select: { status: true } });
  if (!submission || submission.status !== "GRADED") {
    const error = new Error("A submission must be fully graded before its score can be released.");
    error.code = "SUBMISSION_NOT_GRADED";
    throw error;
  }
  return prisma.submission.update({ where: { id: submission_id }, data: { status: "RELEASED", released_at: new Date() } });
};

module.exports = {
  createSubmission,
  getSubmissionById,
  listSubmissions,
  deleteSubmissionById,
  assertStudentOwnership,
  assertSubmissionEditable,
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
};

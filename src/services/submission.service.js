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
      allowed_attempts: true,
      course: {
        select: {
          id: true,
          name: true,
          code: true,
          teacher_id: true,
          teacher: { select: { id: true, name: true } },
        },
      },
    },
  },
  student: {
    select: {
      id: true,
      name: true,
      email: true,
      student_id: true,
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
        // Fall back to comma-separated parsing for legacy answers.
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
      start_date: true,
      end_date: true,
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

  if (quiz.start_date > new Date()) {
    const error = new Error("Quiz is not available yet.");
    error.code = "QUIZ_NOT_STARTED";
    throw error;
  }

  if (quiz.end_date <= new Date()) {
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

  const attemptCount = await prisma.submission.count({
    where: {
      student_id,
      quiz_id,
    },
  });

  if (attemptCount >= quiz.allowed_attempts) {
    const error = new Error(
      quiz.allowed_attempts === 1
        ? "You have already attempted this quiz."
        : `You have reached the maximum of ${quiz.allowed_attempts} attempts for this quiz.`,
    );
    error.code = "ATTEMPT_LIMIT_REACHED";
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
          allowed_attempts: true,
          questions: { select: { points: true } },
          course: {
            select: {
              id: true,
              name: true,
              code: true,
              teacher_id: true,
              teacher: { select: { id: true, name: true } },
            },
          },
        },
      },
      student: {
        select: { id: true, name: true, email: true, student_id: true },
      },
      answers: {
        include: {
          question: {
            select: {
              id: true,
              question_text: true,
              question_type: true,
              question_order: true,
              points: true,
            },
          },
        },
      },
    },
  });
};

const riskLevelForScore = (score) => score >= 20 ? "HIGH" : score >= 10 ? "MEDIUM" : "LOW";

const listSubmissions = async ({
  skip,
  take,
  student_id,
  quiz_id,
  course_id,
  teacher_id,
  search,
  workflow,
  risk_level,
  submitted_from,
  submitted_to,
  sort = "submitted_at",
  order = "desc",
}) => {
  const where = {};

  if (student_id !== undefined) {
    where.student_id = student_id;
  }

  if (quiz_id !== undefined) where.quiz_id = quiz_id;
  if (course_id !== undefined || teacher_id !== undefined) {
    where.quiz = {
      ...(course_id !== undefined ? { course_id } : {}),
      ...(teacher_id !== undefined ? { course: { teacher_id } } : {}),
    };
  }
  if (search) {
    where.OR = [
      { student: { name: { contains: search } } },
      { student: { email: { contains: search } } },
      { student: { student_id: { contains: search } } },
    ];
  }
  if (submitted_from || submitted_to) {
    where.submitted_at = {
      ...(submitted_from ? { gte: submitted_from } : {}),
      ...(submitted_to ? { lte: submitted_to } : {}),
    };
  }

  const candidates = await prisma.submission.findMany({
    where,
    include: {
      ...submissionPublicInclude,
      quiz: {
        select: {
          id: true,
          title: true,
          status: true,
          allowed_attempts: true,
          questions: { select: { points: true } },
          course: { select: { id: true, name: true, code: true, teacher_id: true, teacher: { select: { id: true, name: true } } } },
        },
      },
      answers: {
        select: {
          teacher_points_awarded: true,
          question: { select: { question_type: true } },
        },
      },
    },
  });

  const logs = candidates.length === 0 ? [] : await prisma.behaviorLog.findMany({
    where: { submission_answer: { submission_id: { in: candidates.map((item) => item.id) } } },
    select: {
      event_type: true,
      submission_answer: { select: { submission_id: true } },
    },
  });
  const attemptRows = candidates.length === 0 ? [] : await prisma.submission.findMany({
    where: {
      student_id: { in: [...new Set(candidates.map((item) => item.student_id))] },
      quiz_id: { in: [...new Set(candidates.map((item) => item.quiz_id))] },
    },
    select: { id: true, student_id: true, quiz_id: true },
    orderBy: { id: "asc" },
  });
  const attemptNumberById = new Map();
  const attemptCounters = new Map();
  attemptRows.forEach((attempt) => {
    const key = `${attempt.student_id}:${attempt.quiz_id}`;
    const number = (attemptCounters.get(key) || 0) + 1;
    attemptCounters.set(key, number);
    attemptNumberById.set(attempt.id, number);
  });
  const integrityBySubmission = new Map();
  logs.forEach((log) => {
    const submissionId = log.submission_answer.submission_id;
    const summary = integrityBySubmission.get(submissionId) || { total_events: 0, suspicious_events: 0, risk_score: 0, event_counts: {} };
    summary.total_events += 1;
    summary.event_counts[log.event_type] = (summary.event_counts[log.event_type] || 0) + 1;
    const weight = eventRiskWeights[log.event_type] || 0;
    if (weight > 0) summary.suspicious_events += 1;
    summary.risk_score += weight;
    integrityBySubmission.set(submissionId, summary);
  });

  const enriched = candidates.map(({ answers, quiz, ...submission }) => {
    const manualAnswers = answers.filter((answer) => ["SHORT_Q", "LONG_Q"].includes(answer.question.question_type));
    const integrity = integrityBySubmission.get(submission.id) || { total_events: 0, suspicious_events: 0, risk_score: 0, event_counts: {} };
    integrity.risk_level = riskLevelForScore(integrity.risk_score);
    const maximumScore = quiz.questions.reduce((sum, question) => sum + (question.points || 0), 0);
    const currentScore = (submission.auto_score || 0) + (submission.manual_score || 0);
    return {
      ...submission,
      quiz: { ...quiz, questions: undefined, maximum_score: maximumScore },
      manual_grading: {
        total: manualAnswers.length,
        remaining: manualAnswers.filter((answer) => answer.teacher_points_awarded === null).length,
      },
      current_score: currentScore,
      percentage: maximumScore > 0 ? Math.round((currentScore / maximumScore) * 1000) / 10 : null,
      attempt_number: attemptNumberById.get(submission.id) || 1,
      behaviorSummary: integrity,
    };
  });

  const summarySource = enriched;
  const summary = {
    total: summarySource.length,
    needs_grading: summarySource.filter((item) => ["SUBMITTED", "IN_REVIEW"].includes(item.status)).length,
    ready_to_release: summarySource.filter((item) => item.status === "GRADED").length,
    released: summarySource.filter((item) => item.status === "RELEASED").length,
    in_progress: summarySource.filter((item) => item.status === "IN_PROGRESS").length,
    high_risk: summarySource.filter((item) => item.behaviorSummary.risk_level === "HIGH").length,
    awaiting_review: summarySource.filter((item) => ["SUBMITTED", "IN_REVIEW", "GRADED"].includes(item.status)).length,
    released_average: (() => { const values = summarySource.filter((item) => item.status === "RELEASED" && item.percentage !== null).map((item) => item.percentage); return values.length ? Math.round(values.reduce((sum, score) => sum + score, 0) / values.length * 10) / 10 : null; })(),
    released_highest: (() => { const values = summarySource.filter((item) => item.status === "RELEASED" && item.percentage !== null).map((item) => item.percentage); return values.length ? Math.max(...values) : null; })(),
  };

  let filtered = enriched.filter((item) => {
    if (risk_level && item.behaviorSummary.risk_level !== risk_level) return false;
    if (workflow === "NEEDS_GRADING") return ["SUBMITTED", "IN_REVIEW"].includes(item.status);
    if (workflow === "READY_TO_RELEASE") return item.status === "GRADED";
    if (workflow === "RELEASED") return item.status === "RELEASED";
    if (workflow === "IN_PROGRESS") return item.status === "IN_PROGRESS";
    if (workflow === "COMPLETED") return item.status !== "IN_PROGRESS";
    if (workflow === "AWAITING_REVIEW") return ["SUBMITTED", "IN_REVIEW", "GRADED"].includes(item.status);
    return true;
  });

  const direction = order === "asc" ? 1 : -1;
  filtered.sort((left, right) => {
    let a;
    let b;
    if (sort === "student") [a, b] = [left.student?.name || "", right.student?.name || ""];
    else if (sort === "score") [a, b] = [left.percentage ?? -1, right.percentage ?? -1];
    else if (sort === "risk") [a, b] = [left.behaviorSummary.risk_score, right.behaviorSummary.risk_score];
    else [a, b] = [new Date(left.completed_at || left.submitted_at), new Date(right.completed_at || right.submitted_at)];
    return (typeof a === "string" ? a.localeCompare(b) : a > b ? 1 : a < b ? -1 : 0) * direction;
  });

  const total = filtered.length;
  return { items: filtered.slice(skip, skip + take), total, summary };
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
          question_order: true,
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
          question_order: true,
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
          question_order: true,
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
    include: { question: { select: { id: true, question_text: true, question_type: true, question_order: true, points: true } } },
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

const getSubmissionsByQuizId = async (quizId, { skip, take }) => {
  const [items, total] = await Promise.all([
    prisma.submission.findMany({
      where: { quiz_id: quizId },
      skip,
      take,
      orderBy: { id: "desc" },
      include: submissionPublicInclude,
    }),
    prisma.submission.count({ where: { quiz_id: quizId } }),
  ]);

  return { items, total };
};

const getQuizSubmissionInsights = async (quizId) => {
  const [quiz, enrolledStudents, submissions] = await Promise.all([
    prisma.quiz.findUnique({
      where: { id: quizId },
      select: {
        id: true, title: true, teacher_id: true,
        course: { select: { id: true, name: true, code: true } },
        questions: { orderBy: { question_order: "asc" }, select: { id: true, question_order: true, question_text: true, question_type: true, points: true } },
      },
    }),
    prisma.enrollment.count({ where: { course: { quizzes: { some: { id: quizId } } } } }),
    prisma.submission.findMany({
      where: { quiz_id: quizId, status: { not: "IN_PROGRESS" } },
      select: {
        id: true, student_id: true, status: true, total_score: true, auto_score: true, manual_score: true,
        answers: { select: { question_id: true, student_answer: true, is_correct: true, points_awarded: true, teacher_points_awarded: true, question: { select: { question_type: true } } } },
      },
    }),
  ]);
  if (!quiz) return null;

  const maximumScore = quiz.questions.reduce((sum, question) => sum + (question.points || 0), 0);
  const completedScores = submissions.filter((item) => ["GRADED", "RELEASED"].includes(item.status)).map((item) => item.total_score ?? item.auto_score + item.manual_score).sort((a, b) => a - b);
  const average = completedScores.length ? completedScores.reduce((sum, score) => sum + score, 0) / completedScores.length : null;
  const middle = Math.floor(completedScores.length / 2);
  const median = completedScores.length ? (completedScores.length % 2 ? completedScores[middle] : (completedScores[middle - 1] + completedScores[middle]) / 2) : null;
  const questionInsights = quiz.questions.map((question) => {
    const responses = submissions.map((submission) => submission.answers.find((answer) => answer.question_id === question.id)).filter(Boolean);
    const written = ["SHORT_Q", "LONG_Q"].includes(question.question_type);
    const awarded = responses.map((answer) => written ? answer.teacher_points_awarded : answer.points_awarded).filter((score) => score !== null);
    return {
      ...question,
      answered: responses.filter((answer) => answer.student_answer !== null && answer.student_answer !== "").length,
      unanswered: submissions.length - responses.filter((answer) => answer.student_answer !== null && answer.student_answer !== "").length,
      correct_rate: written || responses.length === 0 ? null : Math.round(responses.filter((answer) => answer.is_correct).length / responses.length * 1000) / 10,
      average_points: awarded.length ? Math.round(awarded.reduce((sum, score) => sum + score, 0) / awarded.length * 10) / 10 : null,
      awaiting_grading: written ? responses.filter((answer) => answer.teacher_points_awarded === null).length : 0,
    };
  });
  const uniqueStudents = new Set(submissions.map((item) => item.student_id)).size;
  return {
    quiz: { id: quiz.id, title: quiz.title, course: quiz.course, maximum_score: maximumScore },
    participation: { enrolled_students: enrolledStudents, unique_students: uniqueStudents, total_attempts: submissions.length, no_attempt: Math.max(enrolledStudents - uniqueStudents, 0), completion_rate: enrolledStudents ? Math.round(uniqueStudents / enrolledStudents * 1000) / 10 : 0 },
    scores: { count: completedScores.length, average: average === null ? null : Math.round(average * 10) / 10, median, highest: completedScores.at(-1) ?? null, lowest: completedScores[0] ?? null },
    awaiting_grading: questionInsights.reduce((sum, question) => sum + question.awaiting_grading, 0),
    questions: questionInsights,
    teacher_id: quiz.teacher_id,
  };
};

module.exports = {
  riskLevelForScore,
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
  getSubmissionsByQuizId,
  getQuizSubmissionInsights,
};

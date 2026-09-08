import { describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import submissionController from "../src/controllers/submission.controller.js";
import submissionService from "../src/services/submission.service.js";

const { canReviewSubmission } = submissionController;
const { riskLevelForScore } = submissionService;
const prisma = createRequire(import.meta.url)("../src/config/prisma.js");

describe("quiz score release", () => {
  it("releases only graded attempts for the assigned teacher's quiz in one operation", async () => {
    vi.spyOn(prisma.quiz, "findUnique").mockResolvedValue({ course: { teacher_id: 7 } });
    const update = vi.spyOn(prisma.submission, "updateMany").mockResolvedValue({ count: 125 });
    try {
      expect(await submissionService.releaseQuizScores(3, { id: 7, role: "TEACHER" })).toEqual({ count: 125 });
      expect(update).toHaveBeenCalledWith({
        where: { quiz_id: 3, status: "GRADED", quiz: { course: { teacher_id: 7 } } },
        data: { status: "RELEASED", released_at: expect.any(Date) },
      });
    } finally { vi.restoreAllMocks(); }
  });

  it("rejects unrelated teachers and students without changing scores", async () => {
    vi.spyOn(prisma.quiz, "findUnique").mockResolvedValue({ course: { teacher_id: 7 } });
    const update = vi.spyOn(prisma.submission, "updateMany");
    try {
      for (const user of [{ id: 8, role: "TEACHER" }, { id: 7, role: "STUDENT" }]) {
        await expect(submissionService.releaseQuizScores(3, user)).rejects.toMatchObject({ status: 403 });
      }
      expect(update).not.toHaveBeenCalled();
    } finally { vi.restoreAllMocks(); }
  });

  it("allows administrators and returns zero when nothing is ready", async () => {
    vi.spyOn(prisma.quiz, "findUnique").mockResolvedValue({ course: { teacher_id: 7 } });
    vi.spyOn(prisma.submission, "updateMany").mockResolvedValue({ count: 0 });
    try {
      expect(await submissionService.releaseQuizScores(3, { id: 1, role: "ADMIN" })).toEqual({ count: 0 });
    } finally { vi.restoreAllMocks(); }
  });
});

describe("question timing summary", () => {
  it("totals repeat visits without truncating to the timeline page and preserves missing timing", async () => {
    const timing = (question_id, seconds) => ({ submission_answer: { question_id }, metadata: { seconds } });
    const find = vi.spyOn(prisma.behaviorLog, "findMany").mockResolvedValue([
      ...Array.from({ length: 101 }, () => timing(1, 2)),
      timing(2, 0), timing(3, -1), timing(3, "10"),
    ]);
    vi.spyOn(prisma.behaviorLog, "groupBy").mockResolvedValue([]);
    try {
      const summary = await submissionService.getBehaviorSummary({ submission_id: 7 });
      expect(summary.time_per_question).toEqual({ 1: 202, 2: 0 });
      expect(find).toHaveBeenCalledWith({
        where: { event_type: "TIME_SPENT_PER_Q", submission_answer: { submission_id: 7 } },
        select: { metadata: true, submission_answer: { select: { question_id: true } } },
      });
    } finally { vi.restoreAllMocks(); }
  });
});

describe("submission review authorization", () => {
  const submission = { quiz: { course: { teacher_id: 7 } } };

  it("allows the assigned teacher and administrators", () => {
    expect(canReviewSubmission({ id: 7, role: "TEACHER" }, submission)).toBe(true);
    expect(canReviewSubmission({ id: 1, role: "ADMIN" }, submission)).toBe(true);
  });

  it("rejects other teachers and students", () => {
    expect(canReviewSubmission({ id: 8, role: "TEACHER" }, submission)).toBe(false);
    expect(canReviewSubmission({ id: 9, role: "STUDENT" }, submission)).toBe(false);
  });
});

describe("integrity signal thresholds", () => {
  it("uses the documented low, medium, and high boundaries", () => {
    expect(riskLevelForScore(9)).toBe("LOW");
    expect(riskLevelForScore(10)).toBe("MEDIUM");
    expect(riskLevelForScore(19)).toBe("MEDIUM");
    expect(riskLevelForScore(20)).toBe("HIGH");
  });
});

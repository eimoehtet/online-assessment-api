import { describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import submissionService from "../src/services/submission.service.js";
import courseService from "../src/services/course.service.js";
import submissionController from "../src/controllers/submission.controller.js";

const { quizAvailability } = courseService;
const { hideUnreleasedScores } = submissionController;
const prisma = createRequire(import.meta.url)("../src/config/prisma.js");

describe("student quiz availability", () => {
  const now = new Date("2026-09-03T12:00:00Z");
  const base = { status: "PUBLISHED", start_date: new Date("2026-09-03T10:00:00Z"), end_date: new Date("2026-09-03T14:00:00Z"), allowed_attempts: 2, submissions: [] };

  it("distinguishes upcoming, available, in-progress, completed, and closed quizzes", () => {
    expect(quizAvailability({ ...base, start_date: new Date("2026-09-03T13:00:00Z") }, now)).toBe("UPCOMING");
    expect(quizAvailability(base, now)).toBe("AVAILABLE");
    expect(quizAvailability({ ...base, submissions: [{ status: "IN_PROGRESS" }] }, now)).toBe("IN_PROGRESS");
    expect(quizAvailability({ ...base, submissions: [{ status: "SUBMITTED" }, { status: "RELEASED" }] }, now)).toBe("COMPLETED");
    expect(quizAvailability({ ...base, end_date: new Date("2026-09-03T11:00:00Z") }, now)).toBe("CLOSED");
  });

  it("blocks absent students while allowing present students and unmarked attendance", () => {
    expect(quizAvailability({ ...base, quizAttendances: [{ status: false }] }, now)).toBe("ABSENT");
    expect(quizAvailability({ ...base, quizAttendances: [{ status: true }] }, now)).toBe("AVAILABLE");
    expect(quizAvailability({ ...base, quizAttendances: [] }, now)).toBe("AVAILABLE");
  });
});

describe("starting a quiz with attendance", () => {
  it.each([false, true, null])("checks attendance status %s before creating an attempt", async (status) => {
    vi.spyOn(prisma.quiz, "findUnique").mockResolvedValue({ status: "PUBLISHED", course_id: 2, start_date: new Date(0), end_date: new Date(Date.now() + 60000), allowed_attempts: 1 });
    vi.spyOn(prisma.enrollment, "findUnique").mockResolvedValue({ id: 1 });
    const attendance = vi.spyOn(prisma.quizAttendance, "findUnique").mockResolvedValue(status === null ? null : { status });
    vi.spyOn(prisma.submission, "count").mockResolvedValue(0);
    const create = vi.spyOn(prisma.submission, "create").mockResolvedValue({ id: 9 });
    try {
      const attempt = submissionService.createSubmission({ student_id: 4, quiz_id: 3 });
      if (status === false) {
        await expect(attempt).rejects.toMatchObject({ code: "QUIZ_ABSENT" });
        expect(create).not.toHaveBeenCalled();
      } else {
        await expect(attempt).resolves.toEqual({ id: 9 });
      }
      expect(attendance).toHaveBeenCalledWith({ where: { quiz_id_student_id: { quiz_id: 3, student_id: 4 } }, select: { status: true } });
    } finally { vi.restoreAllMocks(); }
  });
});

describe("student result privacy", () => {
  it("removes grading, feedback, and integrity fields before release", () => {
    const hidden = hideUnreleasedScores({ id: 1, status: "SUBMITTED", total_score: 8, auto_score: 5, manual_score: 3, current_score: 8, percentage: 80, feedback: "Private", behaviorSummary: { risk_level: "HIGH" }, answers: [{ is_correct: true }] });
    expect(hidden).toEqual({ id: 1, status: "SUBMITTED", answers: [{}] });
  });

  it("retains released grading fields but never exposes integrity signals", () => {
    const released = hideUnreleasedScores({ id: 1, status: "RELEASED", total_score: 8, feedback: "Good work", behaviorSummary: { risk_level: "HIGH" } });
    expect(released).toEqual({ id: 1, status: "RELEASED", total_score: 8, feedback: "Good work" });
  });
});

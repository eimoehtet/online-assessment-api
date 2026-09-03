import { describe, expect, it } from "vitest";
import courseService from "../src/services/course.service.js";
import submissionController from "../src/controllers/submission.controller.js";

const { quizAvailability } = courseService;
const { hideUnreleasedScores } = submissionController;

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

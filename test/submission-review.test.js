import { describe, expect, it } from "vitest";
import submissionController from "../src/controllers/submission.controller.js";
import submissionService from "../src/services/submission.service.js";

const { canReviewSubmission } = submissionController;
const { riskLevelForScore } = submissionService;

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

import { describe, expect, it } from "vitest";
import courseController from "../src/controllers/course.controller.js";

const { canViewCourseRoster } = courseController;

describe("course roster authorization", () => {
  const course = { id: 12, teacher_id: 7 };

  it("allows a teacher to view their assigned course roster", () => {
    expect(canViewCourseRoster({ id: 7, role: "TEACHER" }, course)).toBe(true);
  });

  it("rejects a teacher viewing another teacher's roster", () => {
    expect(canViewCourseRoster({ id: 8, role: "TEACHER" }, course)).toBe(false);
  });

  it("rejects students from viewing a whole-course roster", () => {
    expect(canViewCourseRoster({ id: 20, role: "STUDENT" }, course)).toBe(false);
  });

  it("retains administrator roster access", () => {
    expect(canViewCourseRoster({ id: 1, role: "ADMIN" }, course)).toBe(true);
  });
});

import { afterEach, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const prisma = require("../src/config/prisma");
const { quizDraft } = require("../src/controllers/quiz-draft.controller");
const payload = { formData: { title: "", end_date: "", status: "PUBLISHED", questions: [{ question_text: "", question_type: "MCQ", options: [{ option_text: "", is_correct: true }] }] }, quizId: null };
const req = (method, body = {}) => ({ method, params: { key: "new" }, user: { id: 7 }, body });
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() });
afterEach(() => vi.restoreAllMocks());

it("stores incomplete drafts without publishing or updating a quiz", async () => {
  const create = vi.spyOn(prisma.quizEditorDraft, "create").mockResolvedValue({});
  const quiz = vi.spyOn(prisma.quiz, "update");
  const res = response();
  await quizDraft(req("PUT", { payload, version: 0 }), res);
  expect(create).toHaveBeenCalledWith({ data: { teacher_id: 7, editor_key: "new", payload, version: 1 } });
  expect(quiz).not.toHaveBeenCalled();
  expect(res.json).toHaveBeenCalledWith({ version: 1 });
});
it("reads only the signed-in teacher's draft", async () => {
  const find = vi.spyOn(prisma.quizEditorDraft, "findUnique").mockResolvedValue(null);
  const res = response();
  await quizDraft(req("GET"), res);
  expect(find).toHaveBeenCalledWith({ where: { teacher_id_editor_key: { teacher_id: 7, editor_key: "new" } } });
  expect(res.json).toHaveBeenCalledWith({ payload: null, version: 0 });
});
it("rejects stale saves and clears using the version check", async () => {
  const update = vi.spyOn(prisma.quizEditorDraft, "updateMany").mockResolvedValue({ count: 0 });
  for (const method of ["PUT", "DELETE"]) {
    const res = response();
    await quizDraft(req(method, { payload, version: 2 }), res);
    expect(res.status).toHaveBeenCalledWith(409);
  }
  expect(update.mock.calls[0][0].where).toEqual({ teacher_id: 7, editor_key: "new", version: 2 });
});
it("rejects another teacher's quiz before reading its draft", async () => {
  vi.spyOn(prisma.quiz, "findFirst").mockResolvedValue(null);
  const draft = vi.spyOn(prisma.quizEditorDraft, "findUnique");
  const res = response();
  await quizDraft({ ...req("GET"), params: { key: "42" } }, res);
  expect(res.status).toHaveBeenCalledWith(404);
  expect(draft).not.toHaveBeenCalled();
});

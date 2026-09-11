const prisma = require("../config/prisma");
const { Prisma } = require("@prisma/client");

const validPayload = (payload) => {
  const form = payload?.formData;
  return form && typeof form.title === "string" && typeof form.end_date === "string"
    && ["DRAFT", "PUBLISHED", "CLOSED"].includes(form.status)
    && Array.isArray(form.questions) && form.questions.every(q => q
      && typeof q.question_text === "string" && ["MCQ", "TRUE_FALSE", "SHORT_Q", "LONG_Q"].includes(q.question_type)
      && Array.isArray(q.options) && q.options.every(o => o && typeof o.option_text === "string" && typeof o.is_correct === "boolean"));
};

const quizDraft = async (req, res) => {
  const key = req.params.key;
  if (key !== "new" && !/^[1-9]\d{0,9}$/.test(key)) return res.status(400).json({ message: "Invalid editor draft." });
  const where = { teacher_id_editor_key: { teacher_id: req.user.id, editor_key: key } };
  try {
    if (key !== "new") {
      const quiz = await prisma.quiz.findFirst({ where: { id: Number(key), teacher_id: req.user.id }, select: { id: true } });
      if (!quiz) return res.status(404).json({ message: "Quiz not found." });
    }
    if (req.method === "GET") {
      const draft = await prisma.quizEditorDraft.findUnique({ where });
      return res.json(draft || { payload: null, version: 0 });
    }
    const { version, payload } = req.body;
    if (!Number.isInteger(version) || version < 0 || (req.method === "PUT" && !validPayload(payload))) {
      return res.status(400).json({ message: "Invalid draft data." });
    }
    if (payload?.quizId != null) {
      if (!Number.isSafeInteger(Number(payload.quizId)) || Number(payload.quizId) <= 0) return res.status(400).json({ message: "Invalid quiz id." });
      const quiz = await prisma.quiz.findFirst({ where: { id: Number(payload.quizId), teacher_id: req.user.id }, select: { id: true } });
      if (!quiz) return res.status(403).json({ message: "Cannot save a draft for this quiz." });
    }
    const data = { payload: req.method === "DELETE" ? Prisma.DbNull : payload, version: version + 1 };
    if (version === 0) {
      await prisma.quizEditorDraft.create({ data: { teacher_id: req.user.id, editor_key: key, ...data } });
    } else {
      const updated = await prisma.quizEditorDraft.updateMany({ where: { teacher_id: req.user.id, editor_key: key, version }, data });
      if (updated.count !== 1) return res.status(409).json({ message: "This draft changed in another tab or device. Reopen the editor before saving again." });
    }
    return res.json({ version: version + 1 });
  } catch (error) {
    if (error.code === "P2002") return res.status(409).json({ message: "This draft changed in another tab or device. Reopen the editor before saving again." });
    console.error("Quiz draft save failed:", error.code || error.message);
    return res.status(503).json({ message: "Server draft saving is unavailable. Please try again." });
  }
};
module.exports = { quizDraft, validPayload };

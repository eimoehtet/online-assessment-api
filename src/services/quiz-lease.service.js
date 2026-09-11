const crypto = require("node:crypto");
const prisma = require("../config/prisma");
const { withSubmissionTransaction } = require("../config/submission-db");
const LEASE_MS = 90_000;
const failure = (status, code, message) => Object.assign(new Error(message), { status, code });

async function withLease(req, mode, operation) {
  const id = Number(req.params.id);
  const token = req.get("X-Quiz-Lease");
  if (!Number.isSafeInteger(id) || id <= 0) throw failure(400, "INVALID_SUBMISSION", "Invalid submission id.");
  if (typeof token !== "string" || !/^[a-zA-Z0-9-]{32,128}$/.test(token)) {
    throw failure(409, "QUIZ_LEASE_REQUIRED", "Reopen this quiz to establish exclusive access.");
  }
  const hash = crypto.createHash("sha256").update(token).digest("hex");
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM submissions WHERE id = ${id} FOR UPDATE`;
    const submission = await tx.submission.findUnique({ where: { id } });
    if (!submission) throw failure(404, "NOT_FOUND", "Submission not found.");
    if (submission.student_id !== req.user.id) throw failure(403, "FORBIDDEN", "Forbidden.");
    if (submission.status !== "IN_PROGRESS") throw failure(409, "QUIZ_CLOSED", "This quiz attempt is no longer editable.");
    const now = new Date();
    const active = submission.lease_expires_at && submission.lease_expires_at > now;
    const owner = submission.lease_token_hash === hash && submission.lease_session_id === req.user.sid;
    if (mode === "claim" ? active && !owner : !active || !owner) {
      throw failure(409, "QUIZ_IN_USE", "This quiz is already open in another browser, or your access has expired. Close the other quiz window and try again after 90 seconds.");
    }
    if (mode === "claim" || mode === "heartbeat") {
      const expiresAt = new Date(now.getTime() + LEASE_MS);
      await tx.submission.update({ where: { id }, data: {
        lease_token_hash: hash, lease_session_id: req.user.sid, lease_expires_at: expiresAt,
      } });
      return { expiresAt, leaseMs: LEASE_MS };
    }
    return withSubmissionTransaction(tx, operation);
  }, { timeout: 15000 });
}

const respondError = (res, error) => res.status(error.status || 503).json({
  code: error.code || "QUIZ_ACCESS_UNAVAILABLE",
  message: error.status ? error.message : "Could not verify quiz access. Please try again.",
});

const leaseEndpoint = (mode) => async (req, res) => {
  try { return res.json(await withLease(req, mode)); }
  catch (error) { return respondError(res, error); }
};

const protectQuizWrite = (handler, starting = false) => async (req, res) => {
  if (req.user.role !== "STUDENT") return handler(req, res);
  try {
    // Send only after commit; controller errors also roll back partial writes.
    const execute = async () => {
      let status = 200;
      let body;
      const reply = { status(value) { status = value; return this; }, json(value) { body = value; return this; }, send(value) { body = value; return this; } };
      await handler(req, reply);
      if (status >= 400) throw Object.assign(new Error(body?.message), { status, responseBody: body });
      return { status, body };
    };
    const response = starting
      ? await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${req.user.id} FOR UPDATE`;
        return withSubmissionTransaction(tx, execute);
      }, { timeout: 15000 })
      : await withLease(req, "write", execute);
    return response.status === 204 ? res.status(204).send() : res.status(response.status).json(response.body);
  } catch (error) {
    if (error.responseBody) return res.status(error.status).json(error.responseBody);
    return respondError(res, error);
  }
};

module.exports = { withLease, leaseEndpoint, protectQuizWrite, LEASE_MS };

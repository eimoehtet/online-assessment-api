import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const prisma = require("../src/config/prisma");
const { db } = require("../src/config/submission-db");
const { withLease, protectQuizWrite, LEASE_MS } = require("../src/services/quiz-lease.service");

describe("exclusive quiz access", () => {
  let row;
  let tx;
  const request = (token = "a".repeat(32), sid = "session-a") => ({
    params: { id: "9" }, user: { id: 4, role: "STUDENT", sid }, get: () => token,
  });
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-12T10:00:00Z"));
    row = { id: 9, student_id: 4, status: "IN_PROGRESS" };
    tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ id: 9 }]),
      submission: {
        findUnique: vi.fn(async () => ({ ...row })),
        update: vi.fn(async ({ data }) => { Object.assign(row, data); return row; }),
      },
      submissionAnswer: { create: vi.fn().mockResolvedValue({ id: 1 }) },
    };
    vi.spyOn(prisma, "$transaction").mockImplementation(async (fn) => fn(tx));
  });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it("claims an attempt for 90 seconds and rejects another browser or session", async () => {
    const lease = await withLease(request(), "claim");
    expect(new Date(lease.expiresAt).getTime() - Date.now()).toBe(LEASE_MS);
    expect(tx.$queryRaw.mock.calls[0][0].join("?")).toContain("FOR UPDATE");
    await expect(withLease(request("b".repeat(32)), "claim")).rejects.toMatchObject({ code: "QUIZ_IN_USE" });
    await expect(withLease(request("a".repeat(32), "session-b"), "claim")).rejects.toMatchObject({ code: "QUIZ_IN_USE" });
  });

  it("renews only the current owner and never revives an expired heartbeat", async () => {
    await withLease(request(), "claim");
    vi.setSystemTime(Date.now() + 20000);
    const lease = await withLease(request(), "heartbeat");
    expect(lease.expiresAt.getTime() - Date.now()).toBe(LEASE_MS);
    await expect(withLease(request("b".repeat(32)), "heartbeat")).rejects.toMatchObject({ code: "QUIZ_IN_USE" });
    vi.setSystemTime(Date.now() + LEASE_MS);
    await expect(withLease(request(), "heartbeat")).rejects.toMatchObject({ code: "QUIZ_IN_USE" });
  });

  it("allows takeover after expiry and fences out the old browser's writes and heartbeat", async () => {
    await withLease(request(), "claim");
    vi.setSystemTime(Date.now() + LEASE_MS);
    await withLease(request("b".repeat(32), "session-b"), "claim");
    const operation = vi.fn();
    await expect(withLease(request(), "write", operation)).rejects.toMatchObject({ code: "QUIZ_IN_USE" });
    await expect(withLease(request(), "heartbeat")).rejects.toMatchObject({ code: "QUIZ_IN_USE" });
    expect(operation).not.toHaveBeenCalled();
  });

  it("requires a valid token, ownership and an unfinished attempt", async () => {
    await expect(withLease(request(""), "claim")).rejects.toMatchObject({ code: "QUIZ_LEASE_REQUIRED" });
    row.student_id = 5;
    await expect(withLease(request(), "claim")).rejects.toMatchObject({ status: 403 });
    row.student_id = 4;
    row.status = "SUBMITTED";
    await expect(withLease(request(), "claim")).rejects.toMatchObject({ code: "QUIZ_CLOSED" });
  });

  it("runs writes in the transaction that holds the lock and sends the response after commit", async () => {
    await withLease(request(), "claim");
    let committed = false;
    prisma.$transaction.mockImplementation(async (fn) => { const result = await fn(tx); committed = true; return result; });
    const handler = async (_req, res) => {
      const answer = await db.submissionAnswer.create({ data: {} });
      res.status(201).json(answer);
    };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn(() => expect(committed).toBe(true)) };
    await protectQuizWrite(handler)(request(), res);
    expect(tx.submissionAnswer.create).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: 1 });
  });

  it("throws controller errors inside the transaction so partial writes roll back", async () => {
    await withLease(request(), "claim");
    let rolledBack = false;
    prisma.$transaction.mockImplementation(async (fn) => { try { return await fn(tx); } catch (err) { rolledBack = true; throw err; } });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await protectQuizWrite(async (_req, reply) => reply.status(400).json({ message: "Invalid answer" }))(request(), res);
    expect(rolledBack).toBe(true);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("never runs a write handler without a valid lease", async () => {
    const handler = vi.fn();
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await protectQuizWrite(handler)(request(""), res);
    expect(handler).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("serializes attempt creation on the student row", async () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await protectQuizWrite(async (_req, reply) => reply.status(201).json({ id: 9 }), true)(request(""), res);
    expect(tx.$queryRaw.mock.calls[0][0].join("?")).toBe("SELECT id FROM users WHERE id = ? FOR UPDATE");
    expect(tx.$queryRaw.mock.calls[0][1]).toBe(4);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});

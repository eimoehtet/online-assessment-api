import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const auth = require("../src/services/auth.service.js");
const cache = require("../src/services/session-cache.js");
const middleware = require("../src/middlewares/auth.middleware.js");
const prisma = require("../src/config/prisma.js");
const student = { id: 42, email: "student@example.com", role: "STUDENT", status: 1 };
const record = (id, user = student) => ({ id, user_id: user.id, user, expiresAt: new Date(Date.now() + 60000) });

describe("student sessions", () => {
  beforeEach(() => {
    vi.stubEnv("JWT_SECRET", "test-only-access-secret");
    vi.stubEnv("REFRESH_TOKEN_PEPPER", "test-only-refresh-pepper");
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    cache.invalidateUser(42);
  });

  it.each(["STUDENT", "TEACHER", "ADMIN"])("allows another login for %s without disturbing existing sessions", async (role) => {
    const transaction = vi.spyOn(prisma, "$transaction");
    const create = vi.spyOn(prisma.authSession, "create").mockResolvedValue({});
    const revoke = vi.spyOn(prisma.authSession, "updateMany");
    await auth.createSession({ ...student, role });
    expect(create).toHaveBeenCalledOnce();
    expect(revoke).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects an old access token even with a stale student cache entry from another server", async () => {
    cache.set("old", record("old"));
    const lookup = vi.spyOn(prisma.authSession, "findFirst").mockResolvedValue(null);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();
    await middleware({ headers: { authorization: `Bearer ${auth.issueAccessToken(student, "old")}` } }, res, next);
    expect(lookup).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("checks student sessions against the database on every request", async () => {
    const lookup = vi.spyOn(prisma.authSession, "findFirst").mockResolvedValueOnce(record("current")).mockResolvedValueOnce(null);
    expect(await auth.getActiveSessionUser("current")).toMatchObject({ id: "current" });
    expect(await auth.getActiveSessionUser("current")).toBeNull();
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it("cannot refresh a revoked login", async () => {
    vi.spyOn(prisma.authSession, "findUnique").mockResolvedValue({ ...record("old"), revokedAt: new Date() });
    const update = vi.spyOn(prisma.authSession, "updateMany");
    expect(await auth.refreshSession("old.secret", "csrf")).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });
});

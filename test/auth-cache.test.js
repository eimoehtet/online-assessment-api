import { beforeEach, describe, expect, it } from "vitest";
import cache from "../src/services/session-cache.js";

describe("active session cache", () => {
  beforeEach(() => {
    cache.invalidate("session-1");
  });

  it("reuses a valid entry and supports explicit invalidation", () => {
    const session = {
      id: "session-1",
      user_id: 42,
      expiresAt: new Date(Date.now() + 60_000),
      user: { id: 42, email: "student@example.com", role: "STUDENT", status: 1 },
    };
    cache.set("session-1", session);
    expect(cache.get("session-1")).toBe(session);

    cache.invalidate("session-1");
    expect(cache.get("session-1")).toBeNull();
  });

  it("invalidates every cached session belonging to a user", () => {
    const expiresAt = new Date(Date.now() + 60_000);
    cache.set("session-1", { id: "session-1", user_id: 42, expiresAt });
    cache.set("session-2", { id: "session-2", user_id: 42, expiresAt });
    cache.invalidateUser(42);
    expect(cache.get("session-1")).toBeNull();
    expect(cache.get("session-2")).toBeNull();
  });
});

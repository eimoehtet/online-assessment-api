import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import requestTiming from "../src/middlewares/request-timing.middleware.js";

describe("request timing middleware", () => {
  afterEach(() => vi.restoreAllMocks());

  it("records method, path, status, and duration without query values", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const app = express();
    app.use(requestTiming);
    app.get("/example", (_req, res) => res.json({ ok: true }));

    await request(app).get("/example?secret=hidden").expect(200, { ok: true });

    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0][0]).toMatch(/^GET \/example 200 [\d.]+ms$/);
    expect(info.mock.calls[0][0]).not.toContain("hidden");
  });
});

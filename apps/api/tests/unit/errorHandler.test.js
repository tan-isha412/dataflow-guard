import { describe, it, expect, vi, afterEach } from "vitest";
import { AppError, errorHandler } from "../../src/middleware/errorHandler.js";

function fakeRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe("errorHandler", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes an AppError's message through unchanged — it's curated on purpose", () => {
    const res = fakeRes();
    const err = new AppError("Policy not found", 404, "POLICY_NOT_FOUND");

    errorHandler(err, { id: "req-1" }, res, () => {});

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: "POLICY_NOT_FOUND", message: "Policy not found", requestId: "req-1" }
    });
  });

  it("never leaks a raw/unexpected error's message to the client (500) — only a generic message", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = fakeRes();
    // Simulates what a real driver/library exception looks like — the
    // exact kind of internal detail (host, port fragments) that must
    // never reach an API response body.
    const err = new Error("connect ECONNREFUSED 10.0.11.42:5432");

    errorHandler(err, { id: "req-2" }, res, () => {});

    expect(res.status).toHaveBeenCalledWith(500);
    const [[body]] = res.json.mock.calls;
    expect(body.error.message).toBe("Something went wrong");
    expect(body.error.message).not.toContain("10.0.11.42");
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.requestId).toBe("req-2");
  });

  it("sanitizes a third-party error's OWN .code too, not just a missing one (e.g. Prisma's P1017 on a dropped DB connection)", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = fakeRes();
    // Real shape: Prisma client errors carry a driver-specific .code
    // (P1017 = "Server has closed the connection") alongside .message —
    // a client seeing "P1017" still learns "this uses Prisma" and
    // "there's a live DB connectivity problem," which is exactly the
    // kind of internal/database detail a production response shouldn't
    // volunteer, even though it's shorter than the full message.
    const err = new Error("Server has closed the connection.");
    err.code = "P1017";

    errorHandler(err, { id: "req-db" }, res, () => {});

    const [[body]] = res.json.mock.calls;
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(body.error.code).not.toBe("P1017");
    expect(body.error.message).toBe("Something went wrong");
  });

  it("still logs the real error server-side, even though the client never sees it", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = fakeRes();
    const err = new Error("connect ECONNREFUSED 10.0.11.42:5432");

    errorHandler(err, { id: "req-3" }, res, () => {});

    expect(errorSpy).toHaveBeenCalledWith("[req-3]", err);
  });

  it("never returns a stack trace to the client", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = fakeRes();
    errorHandler(new Error("boom"), { id: "req-4" }, res, () => {});

    const [[body]] = res.json.mock.calls;
    expect(JSON.stringify(body)).not.toContain("at ");
    expect(body.error.stack).toBeUndefined();
  });
});

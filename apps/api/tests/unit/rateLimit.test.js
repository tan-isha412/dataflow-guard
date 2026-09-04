import { describe, it, expect, vi, afterEach } from "vitest";

// Simulates exactly what a real Redis outage looks like to this app:
// maxRetriesPerRequest: null (required by BullMQ, see config/redis.js)
// means ioredis commands never REJECT while the connection is down —
// they queue and wait forever. A mock that resolves/rejects would not
// catch the bug this test exists for; this promise deliberately never
// settles, the same way the real client behaves during an outage.
vi.mock("../../src/config/redis.js", () => ({
  redisClient: {
    incr: vi.fn(() => new Promise(() => {})),
    expire: vi.fn(() => Promise.resolve())
  }
}));

const { rateLimit } = await import("../../src/middleware/rateLimit.js");

function fakeRes() {
  const res = {};
  res.set = vi.fn(() => res);
  return res;
}

describe("rateLimit — Redis outage behavior", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Regression test for a real bug found by manually stopping Redis
  // and hitting a rate-limited route: without the withTimeout() wrapper
  // in rateLimit.js, redisClient.incr() never rejects during an outage,
  // so the middleware's catch block (meant to fail the limiter open)
  // never runs and every request hangs forever — turning a Redis outage
  // into a full API outage. See docs/testing.md.
  it("fails OPEN within a bounded time when Redis never responds, instead of hanging forever", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const middleware = rateLimit({ windowSeconds: 60, max: 100, scope: "test" });
    const req = { auth: { organizationId: "org-1" }, ip: "127.0.0.1" };
    const res = fakeRes();

    const next = vi.fn();
    const start = Date.now();
    await middleware(req, res, next);
    const elapsedMs = Date.now() - start;

    // Bounded by the middleware's own REDIS_TIMEOUT_MS (1500ms) — a
    // generous margin above that still proves it isn't hanging forever.
    expect(elapsedMs).toBeLessThan(3000);
    // Fails OPEN: next() called with no argument (not an error), so the
    // request proceeds rather than being blocked by the limiter's own
    // dependency being down.
    expect(next).toHaveBeenCalledWith();
    expect(next).not.toHaveBeenCalledWith(expect.any(Error));
  });
});

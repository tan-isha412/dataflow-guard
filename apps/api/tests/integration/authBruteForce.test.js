import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { redisClient } from "../../src/config/redis.js";

// Phase 10: the general rate limiter (rateLimit.test.js) proves the
// middleware works at all; this proves the login-SPECIFIC limiter
// (app.js, scope: "auth-login", max 10/60s) actually applies to
// repeated failed login attempts from the same caller — the concrete
// brute-force/credential-stuffing scenario the general limiter's much
// higher ceiling (100/60s) wouldn't catch in time.
describe("Login brute-force protection", () => {
  const email = `bruteforce-${Date.now()}@example.com`;

  beforeAll(async () => {
    await redisClient.flushdb();
    await request(app).post("/api/v1/auth/register").send({
      email, password: "correct-password-123", fullName: "Brute Force Test", organizationName: "Brute Force Org"
    });
  });

  it(
    "returns 429 after enough failed login attempts, before ever accepting the correct password",
    async () => {
      let lastStatus;
      let sawRateLimited = false;

      // vitest.config.js raises RATE_LIMIT_LOGIN_MAX to 20 for test runs
      // (production's real default, 10, is untouched — see that file).
      // Each of these is a REAL bcrypt.compare() against 12 salt rounds
      // (deliberately slow, by design — password.util.js), not mocked,
      // so this test gets a longer-than-default timeout below.
      for (let i = 0; i < 25; i++) {
        const res = await request(app).post("/api/v1/auth/login").send({ email, password: "wrong-password" });
        lastStatus = res.status;
        if (lastStatus === 429) {
          sawRateLimited = true;
          expect(res.body.error.code).toBe("RATE_LIMITED");
          break;
        }
        // every attempt before the limiter kicks in must be a real
        // credential check (401), never anything that looks like success
        expect(lastStatus).toBe(401);
      }

      expect(sawRateLimited).toBe(true);

      // Even the CORRECT password is rejected once rate-limited — the
      // limiter doesn't get bypassed by finally guessing right.
      const finalAttempt = await request(app).post("/api/v1/auth/login").send({ email, password: "correct-password-123" });
      expect(finalAttempt.status).toBe(429);
    },
    20000
  );
});

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: ["./tests/globalSetup.js"],
    // The general rate limiter's default (100/60s, middleware/
    // rateLimit.js) is a real production abuse-resistance setting —
    // left untouched there. But it's also genuinely exceeded by this
    // suite's OWN incidental unauthenticated traffic (every register
    // call, every "rejects with no Authorization header" test) across
    // 30+ files sharing one IP-keyed Redis bucket within a single
    // ~10s run — found by measuring the real key value after a run
    // (101, one over the default). Raised only for test runs, via
    // Vitest's own env injection (applied to every worker before any
    // test file runs) rather than editing production's default.
    // rateLimit.test.js's own dedicated test is updated to match (it
    // needs a real, tight-enough limit to trip within its loop, just
    // not this same one — see that file).
    env: {
      RATE_LIMIT_GENERAL_MAX: "1000",
      // Same reasoning as RATE_LIMIT_GENERAL_MAX above: authBruteForce.
      // test.js deliberately exhausts the login-specific bucket (by
      // design — that's what it's testing) and Redis keeps that state
      // for the rest of the run, so any OTHER file's legitimate
      // wrong-password check (auth.flow.test.js) collided with it
      // under the production default of 10. Raised for test runs only.
      RATE_LIMIT_LOGIN_MAX: "20"
    }
  }
});

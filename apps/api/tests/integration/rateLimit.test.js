import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

// vitest.config.js raises RATE_LIMIT_GENERAL_MAX to 1000 for test runs
// specifically (production's real default, 100, is untouched — see
// that file) so this suite's own incidental request volume across 30+
// files sharing one IP-keyed bucket for unauthenticated calls doesn't
// trip it by accident.
const TEST_GENERAL_MAX = 1000;

// Fired CONCURRENTLY, not as a sequential awaited loop: the limiter's
// window is 60 real seconds (windowSeconds in app.js), and under full
// full-suite load (many other files' real work competing for the event
// loop/CPU at the same time) a sequential loop of 1000+ awaited round
// trips can take long enough that the Redis key's own TTL expires
// mid-loop, silently resetting the counter before it ever reaches the
// threshold — a real flakiness this exact rewrite fixes. Concurrent
// firing completes in well under a second regardless of contention.
async function fireBurst(token, count) {
  const responses = await Promise.all(
    Array.from({ length: count }, () => request(app).get("/api/v1/orgs/me").set("Authorization", `Bearer ${token}`))
  );
  return responses.map((r) => r.status);
}

async function registerOrg(label) {
  const res = await request(app).post("/api/v1/auth/register").send({
    email: `ratelimit-${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`,
    password: "password123",
    fullName: "Test",
    organizationName: `Rate Limit Test Org (${label})`
  });
  return res.body.accessToken;
}

describe("Rate limiting", () => {
  let accessToken;

  beforeAll(async () => {
    accessToken = await registerOrg("primary");
  });

  it("eventually returns 429 after enough requests", async () => {
    const statuses = await fireBurst(accessToken, TEST_GENERAL_MAX + 20);
    expect(statuses).toContain(429);
  });

  // Regression test for a real bug found during the Phase 11 finishing
  // pass: the general limiter is mounted in app.js BEFORE any router's
  // own requireAuth runs, so req.auth was ALWAYS undefined at the point
  // the key was computed — every authenticated request was silently
  // keyed by req.ip instead of organizationId. Real impact: every
  // organization behind the same egress IP (a shared office network/
  // VPN/NAT — completely normal for a real company) shared ONE rate
  // budget, and a busy org could exhaust it for every other org on
  // that IP. Fixed in rateLimit.js by having the middleware decode the
  // bearer token itself to resolve the key. This test proves the fix:
  // exhausting one org's budget must NOT affect a second, independently
  // registered org, even though supertest sends every request from the
  // same IP.
  it("keys the limit by organization, not by IP — one org's traffic never affects another's budget", async () => {
    const exhaustedOrgToken = await registerOrg("to-exhaust");
    const otherOrgToken = await registerOrg("unaffected");

    const exhaustedStatuses = await fireBurst(exhaustedOrgToken, TEST_GENERAL_MAX + 20);
    expect(exhaustedStatuses).toContain(429);

    const otherOrgResult = await request(app).get("/api/v1/orgs/me").set("Authorization", `Bearer ${otherOrgToken}`);
    expect(otherOrgResult.status).toBe(200);
  });
});

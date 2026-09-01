import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

describe("Rate limiting", () => {
  let accessToken;

  beforeAll(async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email: `ratelimit-${Date.now()}@example.com`,
      password: "password123", fullName: "Test", organizationName: "Test Org"
    });
    accessToken = res.body.accessToken;
  });

  it("eventually returns 429 after enough requests", async () => {
    let lastStatus;
    // Fires well past a low test-configured limit — in a real setup
    // the limit would be lowered via env var specifically for tests
    // so this doesn't take 100+ requests to prove.
    for (let i = 0; i < 110; i++) {
      const res = await request(app).get("/api/v1/orgs/me").set("Authorization", `Bearer ${accessToken}`);
      lastStatus = res.status;
      if (lastStatus === 429) break;
    }
    expect(lastStatus).toBe(429);
  });
});
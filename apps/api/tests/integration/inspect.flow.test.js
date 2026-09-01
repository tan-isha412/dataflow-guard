import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/config/db.js";

// An INTEGRATION test — unlike Day 9's unit tests, this hits a real
// (test) database and the real Express app, proving the pieces
// actually work TOGETHER, not just individually.
describe("POST /api/v1/inspect", () => {
  let accessToken;
  let organizationId;

  beforeAll(async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email: "inspect-test@example.com",
      password: "password123",
      fullName: "Test User",
      organizationName: "Test Org"
    });
    accessToken = res.body.accessToken;
    organizationId = res.body.organization.id;

    await prisma.policy.create({
      data: {
        organizationId,
        name: "Block credit cards",
        priority: 10,
        conditions: [{ field: "DATA_TYPE", operator: "EQUALS", value: "CREDIT_CARD" }],
        action: "BLOCK"
      }
    });
  });

  it("blocks content containing a credit card", async () => {
    const res = await request(app)
      .post("/api/v1/inspect")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ content: "Card number: 4532015112830366" });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe("BLOCK");
    expect(res.body.sanitizedContent).toBeNull();
  });

  it("allows content with no sensitive data", async () => {
    const res = await request(app)
      .post("/api/v1/inspect")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ content: "just a normal sentence" });

    expect(res.body.action).toBe("ALLOW");
  });
});
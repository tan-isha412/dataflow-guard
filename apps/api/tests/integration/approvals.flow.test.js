import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

describe("Approvals flow", () => {
  let accessToken;
  let approvalId;

  beforeAll(async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email: `approvals-test-${Date.now()}@example.com`,
      password: "password123",
      fullName: "Test User",
      organizationName: "Test Org"
    });
    accessToken = res.body.accessToken;
  });

  it("lists approvals for the organization (empty at first)", async () => {
    const res = await request(app).get("/api/v1/approvals").set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("rejects deciding a non-existent approval", async () => {
    const res = await request(app)
      .patch("/api/v1/approvals/nonexistent-id/decide")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ decision: "APPROVED" });
    expect(res.status).toBe(404);
  });
});
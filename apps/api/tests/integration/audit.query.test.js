import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

describe("Audit query", () => {
  let accessToken;

  beforeAll(async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email: `audit-query-${Date.now()}@example.com`,
      password: "password123", fullName: "Test", organizationName: "Test Org"
    });
    accessToken = res.body.accessToken;
    // creating a policy should have triggered a POLICY_CREATED audit event
    await request(app).post("/api/v1/policy").set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "test", priority: 1, action: "ALLOW", conditions: [{ field: "DATA_TYPE", operator: "EQUALS", value: "EMAIL" }] });
  });

  it("returns audit events for the organization", async () => {
    const res = await request(app).get("/api/v1/audit").set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
  });

  it("returns a dashboard summary with numeric fields", async () => {
    const res = await request(app).get("/api/v1/audit/summary").set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.totalScans).toBe("number");
  });
});
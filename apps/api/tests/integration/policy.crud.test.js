import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

describe("Policy CRUD", () => {
  let accessToken;
  let policyId;

  beforeAll(async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email: `policy-crud-${Date.now()}@example.com`,
      password: "password123", fullName: "Test", organizationName: "Test Org"
    });
    accessToken = res.body.accessToken;
  });

  it("creates a policy", async () => {
    const res = await request(app).post("/api/v1/policy")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Test policy", priority: 1, action: "BLOCK", conditions: [{ field: "DATA_TYPE", operator: "EQUALS", value: "EMAIL" }] });
    expect(res.status).toBe(201);
    policyId = res.body.id;
  });

  it("updates the policy just created", async () => {
    const res = await request(app).patch(`/api/v1/policy/${policyId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ priority: 5 });
    expect(res.status).toBe(200);
    expect(res.body.priority).toBe(5);
  });

  it("deletes the policy", async () => {
    const res = await request(app).delete(`/api/v1/policy/${policyId}`).set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(204);
  });
});
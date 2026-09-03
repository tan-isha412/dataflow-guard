import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/config/db.js";

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

  it("rejects a policy with an invalid action (e.g. a typo) rather than silently accepting it", async () => {
    const res = await request(app).post("/api/v1/policy")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Typo policy", action: "BLOK", conditions: [{ field: "DATA_TYPE", operator: "EQUALS", value: "EMAIL" }] });
    expect(res.status).toBe(400);
  });

  it("rejects a policy with an unknown condition field/operator", async () => {
    const res = await request(app).post("/api/v1/policy")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Bad field", action: "BLOCK", conditions: [{ field: "NOT_A_REAL_FIELD", operator: "EQUALS", value: "x" }] });
    expect(res.status).toBe(400);
  });

  it("a disabled policy is never considered during inspection", async () => {
    const createRes = await request(app).post("/api/v1/policy")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Block phones", priority: 10, action: "BLOCK", conditions: [{ field: "DATA_TYPE", operator: "EQUALS", value: "PHONE" }] });
    const disabledPolicyId = createRes.body.id;
    await prisma.policy.update({ where: { id: disabledPolicyId }, data: { enabled: false } });

    const inspectRes = await request(app).post("/api/v1/inspect")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ content: "call me at 415-555-0199" });

    expect(inspectRes.body.action).toBe("ALLOW"); // the disabled BLOCK policy never gets a chance to match
    expect(inspectRes.body.matchedPolicyIds).not.toContain(disabledPolicyId);
  });
});
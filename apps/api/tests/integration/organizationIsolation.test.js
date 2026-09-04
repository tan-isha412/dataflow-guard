import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

// Phase 8 acceptance criterion: an administrator from Organization A
// must not be able to see Organization B's users, policies,
// destinations, audit events, approvals, or analytics — and the
// backend must enforce this, not just the frontend hiding a link.
// Every route under test derives organizationId from req.auth (the
// verified JWT), never from a client-supplied id, so there's no
// "?organizationId=" parameter to even attempt an IDOR through — these
// tests instead prove that org A's OWN token, used normally, simply
// never surfaces org B's data.
describe("Organization isolation across dashboard-relevant endpoints", () => {
  let tokenA;
  let tokenB;
  let orgAId;
  let policyAId;
  let destinationAId;
  let approvalAId;

  beforeAll(async () => {
    const a = await request(app).post("/api/v1/auth/register").send({
      email: `isolation-org-a-${Date.now()}@example.com`, password: "password123", fullName: "Org A Admin", organizationName: "Org A"
    });
    tokenA = a.body.accessToken;
    orgAId = a.body.organization.id;

    const b = await request(app).post("/api/v1/auth/register").send({
      email: `isolation-org-b-${Date.now()}@example.com`, password: "password123", fullName: "Org B Admin", organizationName: "Org B"
    });
    tokenB = b.body.accessToken;

    const policyRes = await request(app).post("/api/v1/policy").set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Org A policy", action: "REQUIRE_APPROVAL", conditions: [{ field: "DATA_TYPE", operator: "EQUALS", value: "PHONE" }] });
    policyAId = policyRes.body.id;

    const destRes = await request(app).post("/api/v1/destinations").set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Org A destination", type: "EXTERNAL_AI" });
    destinationAId = destRes.body.id;

    const inspectRes = await request(app).post("/api/v1/inspect").set("Authorization", `Bearer ${tokenA}`)
      .send({ content: "call me at 415-555-0199" });
    approvalAId = inspectRes.body.approvalRequestId;
  });

  it("org B's policy list never includes org A's policies", async () => {
    const res = await request(app).get("/api/v1/policy").set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(200);
    expect(res.body.some((p) => p.id === policyAId)).toBe(false);
  });

  it("org B cannot update or delete org A's policy by guessing its id", async () => {
    const patchRes = await request(app).patch(`/api/v1/policy/${policyAId}`).set("Authorization", `Bearer ${tokenB}`).send({ priority: 99 });
    expect(patchRes.status).toBe(404);

    const deleteRes = await request(app).delete(`/api/v1/policy/${policyAId}`).set("Authorization", `Bearer ${tokenB}`);
    expect(deleteRes.status).toBe(404);
  });

  it("org B's destination list never includes org A's destinations", async () => {
    const res = await request(app).get("/api/v1/destinations").set("Authorization", `Bearer ${tokenB}`);
    expect(res.body.some((d) => d.id === destinationAId)).toBe(false);
  });

  it("org B cannot change org A's destination status by guessing its id", async () => {
    const res = await request(app)
      .patch(`/api/v1/destinations/${destinationAId}/status`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ status: "BLOCKED" });
    expect(res.status).toBe(404);
  });

  it("org B's audit log never includes org A's events", async () => {
    const res = await request(app).get("/api/v1/audit").set("Authorization", `Bearer ${tokenB}`);
    expect(res.body.some((e) => e.organizationId === orgAId)).toBe(false);
  });

  it("org B's dashboard summary is independent of org A's activity", async () => {
    const res = await request(app).get("/api/v1/audit/summary").set("Authorization", `Bearer ${tokenB}`);
    expect(res.body.totalScans).toBe(0); // org A ran an /inspect, org B never has
  });

  it("org B's analytics never reflect org A's detections", async () => {
    const res = await request(app).get("/api/v1/analytics/detections-by-type").set("Authorization", `Bearer ${tokenB}`);
    expect(res.body.find((row) => row.type === "PHONE")).toBeUndefined();
  });

  it("org B cannot fetch org A's approval by guessing its id", async () => {
    const res = await request(app).get(`/api/v1/approvals/${approvalAId}`).set("Authorization", `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it("org B cannot decide (approve/reject) org A's approval", async () => {
    const res = await request(app)
      .patch(`/api/v1/approvals/${approvalAId}/decide`)
      .set("Authorization", `Bearer ${tokenB}`)
      .send({ decision: "APPROVED" });
    expect(res.status).toBe(404);
  });

  it("org B's member list never includes org A's members", async () => {
    const res = await request(app).get("/api/v1/orgs/members").set("Authorization", `Bearer ${tokenB}`);
    expect(res.body.some((m) => m.user.email === "isolation-org-a@example.com")).toBe(false);
  });

  it("org B cannot read org A's org profile via /orgs/me (it's always the caller's own org)", async () => {
    const res = await request(app).get("/api/v1/orgs/me").set("Authorization", `Bearer ${tokenB}`);
    expect(res.body.id).not.toBe(orgAId);
    expect(res.body.name).toBe("Org B");
  });
});

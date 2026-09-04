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
      email: `inspect-test-${Date.now()}@example.com`,
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

  // Phase 5's central auth requirement: the backend derives organization
  // identity from the verified JWT, never from anything the client sends.
  it("ignores a client-supplied organizationId — the decision is scoped to the authenticated org, not the claimed one", async () => {
    const otherOrg = await request(app).post("/api/v1/auth/register").send({
      email: `inspect-other-org-${Date.now()}@example.com`,
      password: "password123",
      fullName: "Other Org User",
      organizationName: "Other Org"
    });
    const otherOrgId = otherOrg.body.organization.id;

    // No BLOCK policy exists in "Other Org" — if organizationId from the
    // body were ever honored, this credit card would sail through as
    // ALLOW because the wrong org's policies would be consulted.
    const res = await request(app)
      .post("/api/v1/inspect")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ content: "Card number: 4532015112830366", organizationId: otherOrgId });

    expect(res.status).toBe(200);
    expect(res.body.action).toBe("BLOCK"); // still evaluated against the AUTHENTICATED org's policy

    const decisions = await prisma.decision.findMany({ where: { organizationId } });
    expect(decisions.some((d) => d.action === "BLOCK")).toBe(true);
    const otherOrgDecisions = await prisma.decision.findMany({ where: { organizationId: otherOrgId } });
    expect(otherOrgDecisions.length).toBe(0); // nothing was ever written to the claimed org
  });

  it("rejects an unauthenticated request rather than defaulting to ALLOW", async () => {
    const res = await request(app).post("/api/v1/inspect").send({ content: "hello" });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/v1/inspect — destination-aware policy and risk (Phase 7)", () => {
  let accessToken;
  let organizationId;

  beforeAll(async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email: `inspect-destination-test-${Date.now()}@example.com`,
      password: "password123",
      fullName: "Destination Test User",
      organizationName: "Destination Test Org"
    });
    accessToken = res.body.accessToken;
    organizationId = res.body.organization.id;

    await prisma.policy.create({
      data: {
        organizationId,
        name: "Require approval for unrecognized destinations",
        priority: 5,
        conditions: [{ field: "DESTINATION_RISK", operator: "EQUALS", value: "HIGH" }],
        action: "REQUIRE_APPROVAL"
      }
    });
  });

  it("requires approval for a destination-only policy match, even with no sensitive data detected", async () => {
    const res = await request(app)
      .post("/api/v1/inspect")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ content: "just a normal sentence", destinationId: "some-unlisted-ai-tool", displayName: "Some Unlisted AI Tool" });

    expect(res.body.action).toBe("REQUIRE_APPROVAL");
    expect(res.body.approvalRequestId).toBeTruthy();
    expect(res.body.destination.riskLevel).toBe("HIGH");
  });

  it("does not require approval for a well-known destination (chatgpt) at MEDIUM risk", async () => {
    const res = await request(app)
      .post("/api/v1/inspect")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ content: "just a normal sentence", destinationId: "chatgpt", displayName: "ChatGPT" });

    expect(res.body.action).toBe("ALLOW");
    expect(res.body.destination.riskLevel).toBe("MEDIUM");
  });

  it("does not add destination risk when no destination is reported at all (e.g. Playground)", async () => {
    const res = await request(app)
      .post("/api/v1/inspect")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ content: "just a normal sentence" });

    expect(res.body.action).toBe("ALLOW");
    expect(res.body.destination.riskLevel).toBe("LOW");
  });

  it("blocks outright when the destination has been marked BLOCKED by an admin, without needing a matching content policy", async () => {
    await request(app)
      .post("/api/v1/destinations")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ name: "Shady AI Tool", type: "EXTERNAL_AI" });

    const destinations = await prisma.destination.findMany({ where: { organizationId } });
    const shady = destinations.find((d) => d.name === "Shady AI Tool");
    await prisma.destination.update({ where: { id: shady.id }, data: { status: "BLOCKED" } });

    const res = await request(app)
      .post("/api/v1/inspect")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ content: "hello", destinationId: "shady", displayName: "Shady AI Tool" });

    expect(res.body.action).toBe("BLOCK");
    expect(res.body.reason).toContain("blocked");
  });
});

describe("POST /api/v1/inspect — REQUIRE_APPROVAL creates a real, fetchable Approval", () => {
  it("creates an approval that GET /api/v1/approvals/:id can then read back (extension polling)", async () => {
    const registerRes = await request(app).post("/api/v1/auth/register").send({
      email: `inspect-approval-fetch-${Date.now()}@example.com`,
      password: "password123",
      fullName: "Approval Fetch User",
      organizationName: "Approval Fetch Org"
    });
    const accessToken = registerRes.body.accessToken;
    const organizationId = registerRes.body.organization.id;

    await prisma.policy.create({
      data: {
        organizationId,
        name: "Require approval for phone numbers",
        priority: 5,
        conditions: [{ field: "DATA_TYPE", operator: "EQUALS", value: "PHONE" }],
        action: "REQUIRE_APPROVAL"
      }
    });

    const inspectRes = await request(app)
      .post("/api/v1/inspect")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ content: "call me at 415-555-0199" });

    expect(inspectRes.body.action).toBe("REQUIRE_APPROVAL");
    const approvalId = inspectRes.body.approvalRequestId;
    expect(approvalId).toBeTruthy();

    const getRes = await request(app)
      .get(`/api/v1/approvals/${approvalId}`)
      .set("Authorization", `Bearer ${accessToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.status).toBe("PENDING");

    // Another organization can't read it, even by guessing/reusing a
    // valid-looking id.
    const otherOrgRes = await request(app).post("/api/v1/auth/register").send({
      email: `inspect-approval-fetch-other-${Date.now()}@example.com`,
      password: "password123",
      fullName: "Other Org",
      organizationName: "Other Approval Org"
    });
    const crossOrgRes = await request(app)
      .get(`/api/v1/approvals/${approvalId}`)
      .set("Authorization", `Bearer ${otherOrgRes.body.accessToken}`);
    expect(crossOrgRes.status).toBe(404);
  });
});
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

// Phase 6: the one real, wired privacy-configuration knob orgs get
// (see docs/privacy.md for why there isn't a second "raw content"
// toggle) — auditRetentionDays on the org, admin-only.
describe("PATCH /api/v1/orgs/me/privacy-settings", () => {
  let accessToken;

  beforeAll(async () => {
    // A unique email per run — like every other integration test in this
    // suite — is required because the test DB isn't reset between runs;
    // a hardcoded email here caused a real bug: the second time this
    // file ran against an already-populated DB, register() returned 409
    // (no accessToken), and every assertion below silently got a 401
    // instead of testing what it claimed to.
    const res = await request(app).post("/api/v1/auth/register").send({
      email: `privacy-settings-test-${Date.now()}@example.com`,
      password: "password123",
      fullName: "Privacy Settings Admin",
      organizationName: "Privacy Settings Org"
    });
    accessToken = res.body.accessToken;
  });

  it("sets an audit retention window", async () => {
    const res = await request(app)
      .patch("/api/v1/orgs/me/privacy-settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ auditRetentionDays: 30 });

    expect(res.status).toBe(200);
    expect(res.body.auditRetentionDays).toBe(30);
  });

  it("accepts null to mean 'retain indefinitely'", async () => {
    const res = await request(app)
      .patch("/api/v1/orgs/me/privacy-settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ auditRetentionDays: null });

    expect(res.status).toBe(200);
    expect(res.body.auditRetentionDays).toBeNull();
  });

  it("rejects an out-of-range retention window rather than silently clamping it", async () => {
    const res = await request(app)
      .patch("/api/v1/orgs/me/privacy-settings")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ auditRetentionDays: 0 });

    expect(res.status).toBe(400);
  });

  it("rejects the request with no Authorization header", async () => {
    const res = await request(app).patch("/api/v1/orgs/me/privacy-settings").send({ auditRetentionDays: 30 });
    expect(res.status).toBe(401);
  });
});

// requirePermission("org:manage")'s ADMIN-allows/VIEWER-denies behavior
// is already covered generically by tests/unit/rbac.middleware.test.js
// (which this route uses, per orgs.routes.js) — not re-derived here.

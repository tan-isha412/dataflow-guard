import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/config/db.js";
import { signAccessToken } from "../../src/modules/auth/jwt.util.js";
import { ROLES } from "@dataflow-guardian/shared";

// Phase 10: rbac.middleware.test.js already unit-tests the middleware
// itself (ADMIN allows / VIEWER denies on one permission, in isolation).
// This is the integration-level complement: every real role, against
// real endpoints, through the real app — proving the ROLE_PERMISSIONS
// table (packages/shared/src/types/role.js) is actually what's enforced
// end to end, not just what the middleware unit test exercises.
//
// Tokens are signed directly with the real signAccessToken() (same
// function login/register use) rather than obtained via a login
// round-trip, because this app's login flow picks memberships[0] for a
// multi-org user with no way to select which org (a real, separately
// documented limitation — see docs/security.md) — signing directly
// tests the actual authorization boundary (JWT claims -> requireAuth ->
// requirePermission) without being blocked by that unrelated gap. Every
// user/membership row these tokens reference is a real row this test
// creates, and every claim in the token matches it.
describe("RBAC — every role against real endpoints", () => {
  let organizationId;
  let adminToken;
  const tokensByRole = {};

  beforeAll(async () => {
    const admin = await request(app).post("/api/v1/auth/register").send({
      email: `rbac-admin-${Date.now()}@example.com`,
      password: "password123",
      fullName: "RBAC Admin",
      organizationName: "RBAC Test Org"
    });
    organizationId = admin.body.organization.id;
    adminToken = admin.body.accessToken;

    for (const role of Object.values(ROLES)) {
      if (role === ROLES.ADMIN) {
        tokensByRole[role] = adminToken;
        continue;
      }
      const user = await prisma.user.create({
        data: {
          email: `rbac-${role.toLowerCase()}-${Date.now()}@example.com`,
          passwordHash: "not-used-in-this-test-tokens-are-signed-directly",
          fullName: `RBAC ${role}`
        }
      });
      await prisma.membership.create({ data: { userId: user.id, organizationId, role } });
      tokensByRole[role] = signAccessToken({ userId: user.id, organizationId, role });
    }
  });

  // action -> { method, path, body, expectedAllowedStatus }. Every role
  // NOT in `allowed` for a given action must get 403 — this is checked
  // generically below rather than duplicated per role.
  const actions = [
    { name: "org:manage (rename org)", method: "patch", path: "/api/v1/orgs/me", body: { name: "Renamed" }, allowed: [ROLES.ADMIN] },
    {
      name: "users:manage (invite member)",
      method: "post",
      path: "/api/v1/orgs/members/invite",
      body: { email: "nobody@example.com", role: ROLES.VIEWER },
      allowed: [ROLES.ADMIN],
      // USER_NOT_FOUND (404) is still a real authorization PASS here —
      // it means requirePermission let the request through to the
      // handler at all, which is what this test is actually checking.
      acceptableStatuses: [201, 404]
    },
    {
      name: "policies:write (create policy)",
      method: "post",
      path: "/api/v1/policy",
      body: { name: "x", action: "ALLOW", conditions: [{ field: "DATA_TYPE", operator: "EQUALS", value: "EMAIL" }] },
      allowed: [ROLES.ADMIN, ROLES.SECURITY_ANALYST]
    },
    {
      name: "destinations:write (create destination)",
      method: "post",
      path: "/api/v1/destinations",
      body: { name: "x", type: "EXTERNAL_AI" },
      allowed: [ROLES.ADMIN, ROLES.SECURITY_ANALYST]
    },
    {
      name: "approvals:decide (decide a non-existent approval)",
      method: "patch",
      path: "/api/v1/approvals/00000000-0000-0000-0000-000000000000/decide",
      body: { decision: "APPROVED" },
      allowed: [ROLES.ADMIN, ROLES.SECURITY_ANALYST, ROLES.APPROVER],
      acceptableStatuses: [404] // no such approval — still proves the permission gate let it through
    },
    {
      name: "inspect:run (run an inspection)",
      method: "post",
      path: "/api/v1/inspect",
      body: { content: "hello" },
      allowed: [ROLES.ADMIN, ROLES.SECURITY_ANALYST, ROLES.APPROVER, ROLES.DEVELOPER]
    }
  ];

  for (const action of actions) {
    for (const role of Object.values(ROLES)) {
      const shouldAllow = action.allowed.includes(role);
      it(`${role} ${shouldAllow ? "CAN" : "CANNOT"} perform ${action.name}`, async () => {
        const res = await request(app)
          [action.method](action.path)
          .set("Authorization", `Bearer ${tokensByRole[role]}`)
          .send(action.body);

        if (shouldAllow) {
          const okStatuses = action.acceptableStatuses ?? [200, 201];
          expect(okStatuses).toContain(res.status);
        } else {
          expect(res.status).toBe(403);
          expect(res.body.error.code).toBe("FORBIDDEN");
        }
      });
    }
  }

  it("every role can read its own org's audit log (audit:read is universal)", async () => {
    for (const role of Object.values(ROLES)) {
      const res = await request(app).get("/api/v1/audit").set("Authorization", `Bearer ${tokensByRole[role]}`);
      expect(res.status).toBe(200);
    }
  });
});

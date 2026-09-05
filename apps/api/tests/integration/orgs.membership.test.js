import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { prisma } from "../../src/config/db.js";
import { ROLES } from "@dataflow-guardian/shared";

// Real bug found during the Phase 11 finishing pass: changeMemberRole()
// had no protection against demoting an organization's only ADMIN —
// since there's no account-recovery path (see docs/security.md), that
// would have permanently locked the org out of ever managing its own
// members/policies/destinations again. Fixed in membership.service.js;
// these tests prove the fix against the real endpoint, not just the
// service function in isolation.
describe("PATCH /orgs/members/:userId/role", () => {
  let organizationId;
  let adminToken;
  let soleAdminUserId;

  beforeAll(async () => {
    const res = await request(app).post("/api/v1/auth/register").send({
      email: `membership-admin-${Date.now()}@example.com`,
      password: "password123",
      fullName: "Sole Admin",
      organizationName: "Membership Test Org"
    });
    organizationId = res.body.organization.id;
    adminToken = res.body.accessToken;
    soleAdminUserId = res.body.user.id;
  });

  it("refuses to demote the organization's only admin", async () => {
    const res = await request(app)
      .patch(`/api/v1/orgs/members/${soleAdminUserId}/role`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: ROLES.VIEWER });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("LAST_ADMIN");

    const membership = await prisma.membership.findUnique({
      where: { userId_organizationId: { userId: soleAdminUserId, organizationId } }
    });
    expect(membership.role).toBe(ROLES.ADMIN); // unchanged
  });

  it("allows demoting an admin once a second admin exists", async () => {
    const secondAdmin = await prisma.user.create({
      data: { email: `second-admin-${Date.now()}@example.com`, passwordHash: "unused", fullName: "Second Admin" }
    });
    await prisma.membership.create({ data: { userId: secondAdmin.id, organizationId, role: ROLES.ADMIN } });

    const res = await request(app)
      .patch(`/api/v1/orgs/members/${soleAdminUserId}/role`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: ROLES.VIEWER });

    expect(res.status).toBe(200);
    expect(res.body.role).toBe(ROLES.VIEWER);

    // Restore for any other test relying on adminToken's ADMIN role.
    await prisma.membership.update({
      where: { userId_organizationId: { userId: soleAdminUserId, organizationId } },
      data: { role: ROLES.ADMIN }
    });
  });

  it("returns 404 for a userId that isn't actually a member of this org", async () => {
    const res = await request(app)
      .patch("/api/v1/orgs/members/00000000-0000-0000-0000-000000000000/role")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ role: ROLES.VIEWER });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("MEMBER_NOT_FOUND");
  });
});

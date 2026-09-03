import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@prisma/client";
import { runRetentionSweep } from "../src/processors/auditAggregation.processor.js";

// Exercises the actual deletion logic against a real (test) database —
// this is what backs the retention claims in docs/privacy.md, so it's
// worth more than a mocked-Prisma unit test.
describe("runRetentionSweep", () => {
  const prisma = new PrismaClient();
  let keepForeverOrgId;
  let retentionOrgId;

  beforeAll(async () => {
    const keepForever = await prisma.organization.create({ data: { name: "Keep Forever Org", auditRetentionDays: null } });
    keepForeverOrgId = keepForever.id;

    const retention = await prisma.organization.create({ data: { name: "30 Day Retention Org", auditRetentionDays: 30 } });
    retentionOrgId = retention.id;

    const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
    const recent = new Date(); // now

    for (const organizationId of [keepForeverOrgId, retentionOrgId]) {
      await prisma.auditEvent.create({
        data: { organizationId, eventType: "INSPECTION_ALLOW", metadata: {}, createdAt: old }
      });
      await prisma.auditEvent.create({
        data: { organizationId, eventType: "INSPECTION_ALLOW", metadata: {}, createdAt: recent }
      });
      await prisma.decision.create({
        data: {
          organizationId, action: "ALLOW", status: "FINAL", riskScore: 0, reason: "x",
          matchedPolicyIds: [], detections: [], createdAt: old
        }
      });
    }
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { organizationId: { in: [keepForeverOrgId, retentionOrgId] } } });
    await prisma.decision.deleteMany({ where: { organizationId: { in: [keepForeverOrgId, retentionOrgId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [keepForeverOrgId, retentionOrgId] } } });
    await prisma.$disconnect();
  });

  it("deletes only rows older than the org's own retention window, and only for orgs that opted in", async () => {
    const results = await runRetentionSweep(prisma);
    const forRetentionOrg = results.find((r) => r.organizationId === retentionOrgId);

    expect(forRetentionOrg).toBeDefined();
    expect(forRetentionOrg.deletedEvents).toBe(1); // the 60-day-old one only
    expect(forRetentionOrg.deletedDecisions).toBe(1);
    expect(results.some((r) => r.organizationId === keepForeverOrgId)).toBe(false); // never touched

    const remainingForRetentionOrg = await prisma.auditEvent.count({ where: { organizationId: retentionOrgId } });
    expect(remainingForRetentionOrg).toBe(1); // the recent one survives

    const keepForeverCount = await prisma.auditEvent.count({ where: { organizationId: keepForeverOrgId } });
    expect(keepForeverCount).toBe(2); // both survive — no retention window set
  });
});

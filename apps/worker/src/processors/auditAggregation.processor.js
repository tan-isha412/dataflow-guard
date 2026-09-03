import { Worker } from "bullmq";
import { PrismaClient } from "@prisma/client";
import { connection } from "../config/connection.js";

const prisma = new PrismaClient();

// Enforces each organization's own audit/decision retention window
// (Organization.auditRetentionDays — Phase 6 privacy configuration).
// A null/unset value means "retain indefinitely": deletion is strictly
// opt-in per org, since the audit log also serves as compliance
// evidence for admins — this never runs against an org that hasn't
// explicitly set a window.
//
// What gets deleted is already privacy-safe by construction (see
// docs/privacy.md): AuditEvent.metadata and Decision never contain raw
// prompt content, only typed detections/policy ids/scores, so this is
// storage hygiene, not a second line of defense against a leak.
//
// Exported separately from the Worker below so it can be unit tested
// against a real (test) database without needing a live Redis/BullMQ
// job to trigger it — see tests/auditRetentionSweep.test.js.
export async function runRetentionSweep(prismaClient = prisma) {
  const orgs = await prismaClient.organization.findMany({
    where: { auditRetentionDays: { not: null } },
    select: { id: true, auditRetentionDays: true }
  });

  const results = [];
  for (const org of orgs) {
    const cutoff = new Date(Date.now() - org.auditRetentionDays * 24 * 60 * 60 * 1000);
    const [events, decisions] = await Promise.all([
      prismaClient.auditEvent.deleteMany({ where: { organizationId: org.id, createdAt: { lt: cutoff } } }),
      prismaClient.decision.deleteMany({ where: { organizationId: org.id, createdAt: { lt: cutoff } } })
    ]);
    if (events.count || decisions.count) {
      console.log(
        `Retention sweep: org ${org.id} — deleted ${events.count} audit event(s) and ${decisions.count} decision(s) older than ${org.auditRetentionDays}d`
      );
    }
    results.push({ organizationId: org.id, deletedEvents: events.count, deletedDecisions: decisions.count });
  }
  return results;
}

// A Worker LISTENS on a named queue — "audit-aggregation" here must
// match the string used when the Queue was created in queues.js on the
// API side (which also registers the repeatable schedule).
export const auditAggregationWorker = new Worker("audit-aggregation", () => runRetentionSweep(prisma), { connection });

auditAggregationWorker.on("failed", (job, err) => {
  console.error("Audit retention sweep failed:", err.message);
});

import { prisma } from "../../config/db.js";

// Notice: create() only. No update() or delete() function exists in
// this file — the audit log is insert-only by design.
export function createAuditEvent(data) {
  return prisma.auditEvent.create({ data });
}

export function findAuditEventsByOrganization(organizationId, { skip = 0, take = 50, eventType } = {}) {
  return prisma.auditEvent.findMany({
    where: { organizationId, ...(eventType ? { eventType } : {}) },
    orderBy: { createdAt: "desc" },
    skip,
    take
  });
}

export function countDecisionsByOrganization(organizationId) {
  return prisma.decision.count({ where: { organizationId } });
}

export function countDecisionsByAction(organizationId, action) {
  return prisma.decision.count({ where: { organizationId, action } });
}

export function averageRiskScore(organizationId) {
  return prisma.decision.aggregate({
    where: { organizationId },
    _avg: { riskScore: true }
  });
}
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

export function countHighRiskDecisions(organizationId, threshold = 70) {
  return prisma.decision.count({ where: { organizationId, riskScore: { gte: threshold } } });
}

// Bounded window, not "ever" — an org open for years shouldn't need an
// unbounded table scan just to answer "how many people used this
// recently." Same pragmatic JS-side aggregation approach as
// analytics.repository.js's detectionCountsByType.
export async function countActiveUsers(organizationId, sinceDate) {
  const rows = await prisma.auditEvent.findMany({
    where: { organizationId, actorUserId: { not: null }, createdAt: { gte: sinceDate } },
    select: { actorUserId: true },
    distinct: ["actorUserId"]
  });
  return rows.length;
}

export async function listDestinationsSeen(organizationId, sinceDate, limit = 500) {
  const rows = await prisma.auditEvent.findMany({
    where: { organizationId, eventType: { startsWith: "INSPECTION_" }, createdAt: { gte: sinceDate } },
    select: { metadata: true },
    orderBy: { createdAt: "desc" },
    take: limit
  });
  return [...new Set(rows.map((r) => r.metadata?.destinationId).filter(Boolean))];
}
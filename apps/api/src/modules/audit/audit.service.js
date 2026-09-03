import { prisma } from "../../config/db.js";
import * as auditRepository from "./audit.repository.js";

const DASHBOARD_WINDOW_DAYS = 30;

// AuditEvent.actorUserId is a bare id (no Prisma relation to User — see
// schema.prisma), so the activity feed needs a small extra lookup to
// show a human-readable actor instead of a raw uuid. Never resolves or
// exposes anything beyond email/fullName — same fields already visible
// on the Members page.
export async function listAuditEvents(organizationId, filters) {
  const events = await auditRepository.findAuditEventsByOrganization(organizationId, filters);

  const userIds = [...new Set(events.map((e) => e.actorUserId).filter(Boolean))];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true, fullName: true } })
    : [];
  const usersById = new Map(users.map((u) => [u.id, u]));

  return events.map((event) => ({ ...event, actor: event.actorUserId ? usersById.get(event.actorUserId) ?? null : null }));
}

// Backs the /audit/summary endpoint the Phase 8 dashboard reads. Every
// number here is a real count against this org's own Decision/AuditEvent
// rows — nothing here is a placeholder or invented for display purposes.
export async function getDashboardSummary(organizationId) {
  const since = new Date(Date.now() - DASHBOARD_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [
    totalScans,
    allowedCount,
    blockedCount,
    redactedCount,
    pendingApprovalsCount,
    highRiskCount,
    avgRisk,
    activeUsers,
    destinationsSeen
  ] = await Promise.all([
    auditRepository.countDecisionsByOrganization(organizationId),
    auditRepository.countDecisionsByAction(organizationId, "ALLOW"),
    auditRepository.countDecisionsByAction(organizationId, "BLOCK"),
    auditRepository.countDecisionsByAction(organizationId, "REDACT"),
    auditRepository.countDecisionsByAction(organizationId, "REQUIRE_APPROVAL"),
    auditRepository.countHighRiskDecisions(organizationId),
    auditRepository.averageRiskScore(organizationId),
    auditRepository.countActiveUsers(organizationId, since),
    auditRepository.listDestinationsSeen(organizationId, since)
  ]);

  return {
    totalScans,
    allowedCount,
    blockedCount,
    redactedCount,
    pendingApprovals: pendingApprovalsCount,
    highRiskCount,
    avgRiskScore: Math.round(avgRisk._avg.riskScore ?? 0),
    activeUsers,
    destinations: destinationsSeen,
    windowDays: DASHBOARD_WINDOW_DAYS
  };
}
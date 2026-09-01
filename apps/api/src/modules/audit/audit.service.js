import * as auditRepository from "./audit.repository.js";

export async function listAuditEvents(organizationId, filters) {
  return auditRepository.findAuditEventsByOrganization(organizationId, filters);
}

// Backs the /audit/summary endpoint the Day 13 Dashboard is already
// written against. Combines a few simple counts into one response
// shaped exactly like DashboardPage.jsx expects.
export async function getDashboardSummary(organizationId) {
  const [totalScans, blockedCount, pendingApprovalsCount, avgRisk] = await Promise.all([
    auditRepository.countDecisionsByOrganization(organizationId),
    auditRepository.countDecisionsByAction(organizationId, "BLOCK"),
    auditRepository.countDecisionsByAction(organizationId, "REQUIRE_APPROVAL"),
    auditRepository.averageRiskScore(organizationId)
  ]);

  return {
    totalScans,
    blockedCount,
    pendingApprovals: pendingApprovalsCount,
    avgRiskScore: Math.round(avgRisk._avg.riskScore ?? 0),
    riskOverTime: [],       // filled in properly once analytics aggregation exists (Day 19)
    detectionsByType: []    // same
  };
}
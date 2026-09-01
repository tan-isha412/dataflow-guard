import * as analyticsRepository from "./analytics.repository.js";

export async function getRiskOverTime(organizationId, days = 30) {
  const sinceDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await analyticsRepository.decisionsGroupedByDay(organizationId, sinceDate);

  return rows.map((row) => ({
    date: row.date.toISOString().split("T")[0],
    avgRiskScore: Math.round(Number(row.avgRiskScore))
  }));
}

export async function getDetectionsByType(organizationId) {
  const decisions = await analyticsRepository.detectionCountsByType(organizationId);
  const counts = {};

  // detections is stored as JSON on each Decision row — flatten
  // every decision's detections array and tally by type.
  for (const decision of decisions) {
    for (const detection of decision.detections ?? []) {
      counts[detection.type] = (counts[detection.type] ?? 0) + 1;
    }
  }

  return Object.entries(counts).map(([type, count]) => ({ type, count }));
}
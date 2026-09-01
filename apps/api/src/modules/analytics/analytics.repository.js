import { prisma } from "../../config/db.js";

export function decisionsGroupedByDay(organizationId, sinceDate) {
  // Raw SQL here because Prisma's query builder doesn't have a
  // clean way to GROUP BY a truncated date — this is one of the
  // rare, deliberate exceptions to "repositories only use the
  // Prisma client methods," and it's isolated to this one file.
  return prisma.$queryRaw`
    SELECT DATE("createdAt") as date, AVG("riskScore") as "avgRiskScore", COUNT(*) as count
    FROM decisions
    WHERE "organizationId" = ${organizationId} AND "createdAt" >= ${sinceDate}
    GROUP BY DATE("createdAt")
    ORDER BY date ASC
  `;
}

export function detectionCountsByType(organizationId) {
  return prisma.decision.findMany({
    where: { organizationId },
    select: { detections: true }
  });
}
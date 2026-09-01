import { prisma } from "../../config/db.js";

// The only place a Decision gets written to the database — kept
// separate from decision.service.js's pure logic on purpose. This
// is called from inspect.service.js on Day 10, once per scan.
export function createDecisionRecord(data) {
  return prisma.decision.create({ data });
}

export function findDecisionsByOrganization(organizationId, { skip = 0, take = 25 } = {}) {
  return prisma.decision.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    skip,
    take
  });
}
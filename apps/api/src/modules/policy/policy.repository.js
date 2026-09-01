import { prisma } from "../../config/db.js";

export function findPoliciesByOrganization(organizationId) {
  // Ordered by priority DESC — highest-priority policy checked first.
  // This ordering is what policy.evaluator.js relies on.
  return prisma.policy.findMany({
    where: { organizationId, enabled: true },
    orderBy: { priority: "desc" }
  });
}

export function createPolicy(data) {
  return prisma.policy.create({ data });
}

export function updatePolicy(id, data) {
  return prisma.policy.update({ where: { id }, data });
}

export function deletePolicy(id) {
  return prisma.policy.delete({ where: { id } });
}
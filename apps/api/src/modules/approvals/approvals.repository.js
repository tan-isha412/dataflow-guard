import { prisma } from "../../config/db.js";

export function createApprovalRequest(data) {
  return prisma.approval.create({ data });
}

export function findApprovalById(id) {
  return prisma.approval.findUnique({ where: { id } });
}

export function findApprovalsByOrganization(organizationId, { status } = {}) {
  return prisma.approval.findMany({
    where: { organizationId, ...(status ? { status } : {}) },
    orderBy: { createdAt: "desc" }
  });
}

export function updateApproval(id, data) {
  return prisma.approval.update({ where: { id }, data });
}
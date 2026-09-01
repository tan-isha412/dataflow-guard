import { prisma } from "../../config/db.js";

export function findOrganizationById(id) {
  return prisma.organization.findUnique({ where: { id } });
}

export function findOrganizationMembers(organizationId) {
  return prisma.membership.findMany({
    where: { organizationId },
    include: { user: { select: { id: true, email: true, fullName: true } } }
  });
}

export function updateOrganizationName(id, name) {
  return prisma.organization.update({ where: { id }, data: { name } });
}
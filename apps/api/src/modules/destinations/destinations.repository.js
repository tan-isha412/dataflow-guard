import { prisma } from "../../config/db.js";

export function findDestinationsByOrganization(organizationId) {
  return prisma.destination.findMany({ where: { organizationId }, orderBy: { createdAt: "desc" } });
}

export function findDestinationById(id) {
  return prisma.destination.findUnique({ where: { id } });
}

export function createDestination(data) {
  return prisma.destination.create({ data });
}

export function updateDestination(id, data) {
  return prisma.destination.update({ where: { id }, data });
}
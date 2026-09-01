import { AppError } from "../../middleware/errorHandler.js";
import { findOrganizationById, findOrganizationMembers, updateOrganizationName } from "./orgs.repository.js";

export async function getOrganization(organizationId) {
  const org = await findOrganizationById(organizationId);
  if (!org) {
    throw new AppError("Organization not found", 404, "ORG_NOT_FOUND");
  }
  return org;
}

export async function listMembers(organizationId) {
  return findOrganizationMembers(organizationId);
}

export async function renameOrganization(organizationId, name) {
  return updateOrganizationName(organizationId, name);
}
import { AppError } from "../../middleware/errorHandler.js";
import {
  findOrganizationById,
  findOrganizationMembers,
  updateOrganizationName,
  updateOrganizationSettings
} from "./orgs.repository.js";

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

// Phase 6 privacy configuration. auditRetentionDays is the only knob
// exposed here on purpose — see the schema comment on Organization for
// why a "retain raw content" toggle isn't offered (there's nothing real
// for it to control).
export async function updatePrivacySettings(organizationId, { auditRetentionDays }) {
  return updateOrganizationSettings(organizationId, { auditRetentionDays });
}
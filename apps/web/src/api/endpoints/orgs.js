import { apiClient } from "../client.js";

export function getOrganization() {
  return apiClient.get("/orgs/me").then((res) => res.data);
}

export function listMembers() {
  return apiClient.get("/orgs/members").then((res) => res.data);
}

export function inviteMember({ email, role }) {
  return apiClient.post("/orgs/members/invite", { email, role }).then((res) => res.data);
}

export function changeMemberRole(userId, role) {
  return apiClient.patch(`/orgs/members/${userId}/role`, { role }).then((res) => res.data);
}

export function updatePrivacySettings(auditRetentionDays) {
  return apiClient.patch("/orgs/me/privacy-settings", { auditRetentionDays }).then((res) => res.data);
}

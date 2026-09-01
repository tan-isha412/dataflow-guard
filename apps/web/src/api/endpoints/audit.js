import { apiClient } from "../client.js";

export function listAuditEvents(params = {}) {
  return apiClient.get("/audit", { params }).then((res) => res.data);
}
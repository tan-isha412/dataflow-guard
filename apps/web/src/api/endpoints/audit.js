import { apiClient } from "../client.js";

export function listAuditEvents(params = {}) {
  return apiClient.get("/audit", { params }).then((res) => res.data);
}

export function getDashboardSummary() {
  return apiClient.get("/audit/summary").then((res) => res.data);
}
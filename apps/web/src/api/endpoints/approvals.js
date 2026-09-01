import { apiClient } from "../client.js";

export function listApprovals(status) {
  return apiClient.get("/approvals", { params: { status } }).then((res) => res.data);
}

export function decideApproval(id, decision) {
  return apiClient.patch(`/approvals/${id}/decide`, { decision }).then((res) => res.data);
}
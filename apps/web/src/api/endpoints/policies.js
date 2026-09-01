import { apiClient } from "../client.js";

export function listPolicies() {
  return apiClient.get("/policy").then((res) => res.data);
}

export function createPolicy(policy) {
  return apiClient.post("/policy", policy).then((res) => res.data);
}

export function updatePolicy(id, updates) {
  return apiClient.patch(`/policy/${id}`, updates).then((res) => res.data);
}

export function deletePolicy(id) {
  return apiClient.delete(`/policy/${id}`).then((res) => res.data);
}
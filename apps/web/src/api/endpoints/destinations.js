import { apiClient } from "../client.js";

export function listDestinations() {
  return apiClient.get("/destinations").then((res) => res.data);
}
export function createDestination(destination) {
  return apiClient.post("/destinations", destination).then((res) => res.data);
}
export function updateDestinationStatus(id, status) {
  return apiClient.patch(`/destinations/${id}/status`, { status }).then((res) => res.data);
}
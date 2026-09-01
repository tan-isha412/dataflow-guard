import { apiClient } from "../client.js";

export function inspectContent(content) {
  return apiClient.post("/inspect", { content }).then((res) => res.data);
}
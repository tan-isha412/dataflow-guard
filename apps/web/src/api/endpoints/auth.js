import { apiClient } from "../client.js";

// Mirrors auth.routes.js on the backend almost 1:1 — same two
// endpoints, same body shapes the zod schemas there expect.
export function register({ email, password, fullName, organizationName }) {
  return apiClient
    .post("/auth/register", { email, password, fullName, organizationName })
    .then((res) => res.data);
}

export function login({ email, password }) {
  return apiClient.post("/auth/login", { email, password }).then((res) => res.data);
}
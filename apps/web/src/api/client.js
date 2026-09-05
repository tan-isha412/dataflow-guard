import axios from "axios";
import { useAuthStore } from "../store/authStore.js";

// The single choke point every API call passes through — same idea
// as db.js being the one shared Prisma instance on the backend.
export const apiClient = axios.create({
  baseURL: "/api/v1" // proxied to localhost:5000 by vite.config.js
});

apiClient.interceptors.request.use((config) => {
  const { accessToken } = useAuthStore.getState();
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// A 401 on an ALREADY-authenticated request means the access token
// expired/was revoked mid-session (there is no refresh flow — see
// docs/security.md's "Authentication" section on why logout/expiry
// are handled this way) — clear the session so ProtectedRoute's own
// isAuthenticated check (reading this same store) redirects to
// /login on its next render, rather than every page having to
// separately notice its queries are failing with 401. Deliberately
// scoped to requests that CARRIED a token: a fresh /auth/login
// attempt with the wrong password also returns 401, and that's a
// completely different, already-handled case (LoginPage's own error
// message) — not a session expiring.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const hadToken = Boolean(error.config?.headers?.Authorization);
    if (error.response?.status === 401 && hadToken) {
      useAuthStore.getState().clearAuth();
    }
    return Promise.reject(error);
  }
);
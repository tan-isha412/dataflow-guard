import { API_BASE_URL } from "../../shared/config.js";
import { getTokens, setTokens, clearAuth } from "./authStorage.js";

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(path, { method = "GET", body, accessToken } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiError("Could not reach the DataFlow Guardian server", 0, "NETWORK_ERROR");
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(data.error?.message ?? "Request failed", response.status, data.error?.code ?? "UNKNOWN_ERROR");
  }
  return data;
}

export function login(email, password) {
  return request("/auth/login", { method: "POST", body: { email, password } });
}

export function refreshTokens(refreshToken) {
  return request("/auth/refresh", { method: "POST", body: { refreshToken } });
}

export function getOrganization(accessToken) {
  return request("/orgs/me", { accessToken });
}

export function getCurrentUser(accessToken) {
  return request("/users/me", { accessToken });
}

/**
 * Authenticated fetch used by everything past login: attaches the stored
 * access token, and on a 401 tries exactly one refresh-and-retry before
 * giving up and clearing the session. A 403 (authenticated but lacking
 * permission) is left untouched — that's not an expired-session problem.
 */
export async function authenticatedRequest(path, options = {}) {
  const tokens = await getTokens();
  if (!tokens) {
    throw new ApiError("Not logged in", 401, "UNAUTHENTICATED");
  }

  try {
    return await request(path, { ...options, accessToken: tokens.accessToken });
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) {
      throw error;
    }

    try {
      const refreshed = await refreshTokens(tokens.refreshToken);
      await setTokens(refreshed);
      return await request(path, { ...options, accessToken: refreshed.accessToken });
    } catch {
      await clearAuth();
      throw new ApiError("Session expired, please log in again", 401, "SESSION_EXPIRED");
    }
  }
}

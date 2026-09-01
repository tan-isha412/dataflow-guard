import * as apiClient from "./apiClient.js";
import { getTokens, setTokens, getProfile, setProfile, clearAuth } from "./authStorage.js";
import { decodeJwtPayload, isTokenExpired } from "./jwt.js";

const LOGGED_OUT = Object.freeze({ authenticated: false, user: null, organization: null, role: null });

async function buildProfile(user, accessToken) {
  const { organizationId, role } = decodeJwtPayload(accessToken);

  // Best-effort: the JWT already carries organizationId/role (that's the
  // backend-issued source of truth for "which org, what role"), but not
  // the org's display name. If this call fails (e.g. transient network
  // issue right after login), we still consider the user logged in —
  // the popup just shows a fallback instead of a name.
  let organization = null;
  try {
    organization = await apiClient.getOrganization(accessToken);
  } catch {
    organization = organizationId ? { id: organizationId, name: null } : null;
  }

  return { user, organization, role };
}

export async function login({ email, password }) {
  const result = await apiClient.login(email, password);
  await setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });

  const profile = await buildProfile(result.user, result.accessToken);
  await setProfile(profile);

  return { authenticated: true, ...profile };
}

export async function logout() {
  await clearAuth();
}

/**
 * Returns the current session with no token in the payload. Ensures the
 * access token is not expired (transparently refreshing if needed) before
 * reporting authenticated — used both by AUTH_GET_SESSION (popup) and by
 * restoreSession() below (startup/reinstall).
 */
export async function getSession() {
  const tokens = await getTokens();
  if (!tokens) {
    return LOGGED_OUT;
  }

  let activeTokens = tokens;
  if (isTokenExpired(tokens.accessToken)) {
    try {
      activeTokens = await apiClient.refreshTokens(tokens.refreshToken);
      await setTokens(activeTokens);
    } catch {
      await clearAuth();
      return LOGGED_OUT;
    }
  }

  let profile = await getProfile();
  if (!profile) {
    // Tokens exist but the profile snapshot is missing (corrupted or
    // cleared independently) — rebuild it rather than silently logging out.
    const user = await apiClient.getCurrentUser(activeTokens.accessToken).catch(() => null);
    profile = await buildProfile(user, activeTokens.accessToken);
    await setProfile(profile);
  }

  return { authenticated: true, ...profile };
}

export async function restoreSession() {
  const session = await getSession();
  console.log(`[DataFlow Guardian] session restored: ${session.authenticated ? "authenticated" : "logged out"}`);
  return session;
}

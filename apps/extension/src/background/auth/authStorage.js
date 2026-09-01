/**
 * Persists auth state in chrome.storage.local, split into two keys on
 * purpose:
 *   - dfg:authTokens  — accessToken/refreshToken. Only ever read by
 *     apiClient.js when attaching a request header or refreshing.
 *   - dfg:authProfile — user/organization/role. This is the ONLY auth
 *     data the AUTH_GET_SESSION message handler returns to callers
 *     (popup today; nothing else in Phase 2), so a caller can never
 *     receive a token just by asking "am I logged in."
 *
 * Tradeoff: chrome.storage.local keeps tokens on-device and, unlike
 * chrome.storage.sync, never leaves the machine via the browser's account
 * sync. It is NOT encrypted at rest by Chrome, and any code running with
 * this extension's "storage" permission (i.e. our own background/popup/
 * content-script code — no other extension or webpage can reach it) can
 * technically read it. That's why content-script.js never imports this
 * module and never receives a token over messaging: the boundary that
 * actually matters here is "only background code touches tokens," not
 * the storage API's own access control, which is coarser than that.
 */
const TOKENS_KEY = "dfg:authTokens";
const PROFILE_KEY = "dfg:authProfile";

export async function getTokens() {
  const result = await chrome.storage.local.get(TOKENS_KEY);
  return result[TOKENS_KEY] ?? null;
}

export async function setTokens({ accessToken, refreshToken }) {
  await chrome.storage.local.set({ [TOKENS_KEY]: { accessToken, refreshToken } });
}

export async function getProfile() {
  const result = await chrome.storage.local.get(PROFILE_KEY);
  return result[PROFILE_KEY] ?? null;
}

export async function setProfile(profile) {
  await chrome.storage.local.set({ [PROFILE_KEY]: profile });
}

export async function clearAuth() {
  await chrome.storage.local.remove([TOKENS_KEY, PROFILE_KEY]);
}

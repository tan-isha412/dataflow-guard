/**
 * Reads (never verifies) JWT claims. The extension is not the authority
 * on these claims — it trusts them only because it just received the
 * token directly from the backend's own /auth/login|register|refresh
 * response. Every subsequent API call still has its token re-verified
 * server-side by requireAuth; nothing here is a security boundary.
 */
export function decodeJwtPayload(token) {
  const [, payloadSegment] = token.split(".");
  if (!payloadSegment) {
    throw new Error("Malformed token: missing payload segment");
  }
  const base64 = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  return JSON.parse(atob(padded));
}

export function getTokenExpiryMs(token) {
  const { exp } = decodeJwtPayload(token);
  return exp * 1000;
}

export function isTokenExpired(token, skewMs = 5000) {
  try {
    return Date.now() >= getTokenExpiryMs(token) - skewMs;
  } catch {
    return true;
  }
}

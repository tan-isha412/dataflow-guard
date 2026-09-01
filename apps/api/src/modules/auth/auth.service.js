import { AppError } from "../../middleware/errorHandler.js";
import { findUserByEmail, createUserWithOrganization } from "./auth.repository.js";
import { hashPassword, verifyPassword } from "./password.util.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "./jwt.util.js";

export async function registerUser({ email, password, fullName, organizationName }) {
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new AppError("An account with this email already exists", 409, "EMAIL_ALREADY_EXISTS");
  }

  const passwordHash = await hashPassword(password);

  const { user, organization, membership } = await createUserWithOrganization({
    email,
    passwordHash,
    fullName,
    organizationName
  });

  return issueTokensFor(user, membership, organization);
}

export async function loginUser({ email, password }) {
  const user = await findUserByEmail(email);
  if (!user) {
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  const isValid = await verifyPassword(password, user.passwordHash);
  if (!isValid) {
    throw new AppError("Invalid email or password", 401, "INVALID_CREDENTIALS");
  }

  // For Day 3, a user has exactly one org (created at registration).
  // Multi-org membership switching is handled once orgs.service.js exists (Day 4).
  const membership = user.memberships?.[0];
  return issueTokensFor(user, membership);
}

export function refreshSession({ refreshToken }) {
  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError("Invalid or expired refresh token", 401, "INVALID_REFRESH_TOKEN");
  }

  // Re-sign both tokens from the same claims rather than re-reading the
  // user/membership from the database — the refresh token was itself
  // issued by this server from a verified membership, so its claims are
  // already trustworthy for the lifetime of the refresh token.
  const tokenPayload = {
    userId: payload.userId,
    organizationId: payload.organizationId,
    role: payload.role
  };

  return {
    accessToken: signAccessToken(tokenPayload),
    refreshToken: signRefreshToken(tokenPayload)
  };
}

function issueTokensFor(user, membership, organization) {
  const tokenPayload = {
    userId: user.id,
    organizationId: membership?.organizationId,
    role: membership?.role
  };

  return {
    user: { id: user.id, email: user.email, fullName: user.fullName },
    organization: organization ? { id: organization.id, name: organization.name } : undefined,
    accessToken: signAccessToken(tokenPayload),
    refreshToken: signRefreshToken(tokenPayload)
  };
}
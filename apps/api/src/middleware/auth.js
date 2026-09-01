import { AppError } from "./errorHandler.js";
import { verifyAccessToken } from "../modules/auth/jwt.util.js";

// Every protected route runs this first. It is the ONLY place that turns
// a bearer token into req.auth — organizationId and role always come from
// the verified JWT, never from the request body/params/query, so a client
// can never claim membership in an org it doesn't belong to.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError("Missing or invalid Authorization header", 401, "UNAUTHENTICATED"));
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = verifyAccessToken(token);
    req.auth = {
      userId: payload.userId,
      organizationId: payload.organizationId,
      role: payload.role
    };
    next();
  } catch {
    next(new AppError("Invalid or expired token", 401, "INVALID_TOKEN"));
  }
}

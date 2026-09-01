import { AppError } from "./errorHandler.js";
import { roleHasPermission } from "@dataflow-guardian/shared";

// A middleware FACTORY — requirePermission("policies:write") returns
// a middleware function tailored to that one permission. Must run
// AFTER requireAuth, since it reads req.auth.role.
export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.auth?.role) {
      return next(new AppError("Not authenticated", 401, "UNAUTHENTICATED"));
    }

    if (!roleHasPermission(req.auth.role, permission)) {
      return next(new AppError("You don't have permission to do this", 403, "FORBIDDEN"));
    }

    next();
  };
}
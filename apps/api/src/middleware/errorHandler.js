// Custom error class so services can throw something meaningful
// ("EMAIL_ALREADY_EXISTS", 409) instead of a generic Error.
export class AppError extends Error {
  constructor(message, statusCode = 500, code = "INTERNAL_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

// Must be registered LAST in app.js — Express only calls error middleware
// (4-arg functions) when something upstream calls next(err) or throws
// inside an async handler wrapped correctly. The 4th param is required
// for Express to even recognize this as error-handling middleware
// (it's a function-arity check, not a naming convention) even though
// it's never called here — named _next, not next, so the linter's
// unused-var check doesn't flag a parameter Express itself requires.
export function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode ?? 500;

  if (statusCode === 500) {
    // Log the error object itself (name/message/stack), never req.body —
    // an AppError never carries prompt content, but a raw thrown value
    // from application code might, so this stays deliberately narrow.
    console.error(`[${req.id}]`, err);
  }

  // An AppError's message AND code are always something a service
  // author wrote on purpose for a client to see ("Policy not found" /
  // "POLICY_NOT_FOUND"). Anything else reaching here is an UNEXPECTED
  // failure — a bug, a raw Prisma/driver exception, a third-party
  // library throwing — and either field can contain an internal detail
  // that shouldn't reach a client: .message might hold a connection
  // string fragment or file path, and .code might be a driver-specific
  // code (e.g. Prisma's "P1017") that reveals implementation details a
  // production error response has no business exposing. Both get
  // sanitized together for anything that isn't an AppError; the real
  // error still went to the log line above, where a developer can act
  // on it.
  const isAppError = err instanceof AppError;
  const code = isAppError ? err.code : "INTERNAL_ERROR";
  const message = isAppError ? err.message : "Something went wrong";

  res.status(statusCode).json({
    error: { code, message, requestId: req.id }
  });
}

// Wraps an async route handler so a rejected promise turns into
// next(err) automatically, instead of an unhandled rejection.
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
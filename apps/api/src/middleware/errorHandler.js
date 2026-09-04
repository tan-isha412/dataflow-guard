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
// inside an async handler wrapped correctly.
export function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode ?? 500;
  const code = err.code ?? "INTERNAL_ERROR";

  if (statusCode === 500) {
    // Log the error object itself (name/message/stack), never req.body —
    // an AppError never carries prompt content, but a raw thrown value
    // from application code might, so this stays deliberately narrow.
    console.error(`[${req.id}]`, err);
  }

  // An AppError's message is always something a service author wrote on
  // purpose for a client to see ("Policy not found", "Invalid or expired
  // token"). Anything else reaching here is an UNEXPECTED failure — a
  // bug, a raw Prisma/driver exception, a third-party library throwing —
  // and its .message can contain exactly the internal detail (a
  // connection string fragment, a file path, a stack-adjacent hint)
  // Phase 9's security review calls out as something a production error
  // response must never leak. Those get a generic message; the real one
  // still went to the log line above, where a developer can act on it.
  const message = err instanceof AppError ? err.message : "Something went wrong";

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
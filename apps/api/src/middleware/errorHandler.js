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

  res.status(statusCode).json({
    error: {
      code,
      message: err.message ?? "Something went wrong",
      requestId: req.id
    }
  });
}

// Wraps an async route handler so a rejected promise turns into
// next(err) automatically, instead of an unhandled rejection.
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
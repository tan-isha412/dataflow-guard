import { AppError } from "./errorHandler.js";

// Another factory. validate(schema) parses req.body against a zod
// schema and replaces req.body with the PARSED (type-coerced,
// defaulted) version, so route handlers never re-validate anything.
// This is the file auth.routes.js's inline zod calls should move
// into now that it exists.
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      const message = result.error.errors.map((e) => e.message).join(", ");
      return next(new AppError(message, 400, "VALIDATION_ERROR"));
    }

    req.body = result.data;
    next();
  };
}
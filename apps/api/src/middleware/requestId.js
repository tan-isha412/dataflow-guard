import { randomUUID } from "node:crypto";

// Assigns one correlation id per request, so a single inspection can be
// traced through detection -> policy -> risk -> decision -> audit in the
// logs without ever needing to log the request body. Accepts an inbound
// X-Request-Id (useful if a future caller wants to correlate its own
// logs with ours) but always falls back to a fresh uuid.
export function requestId(req, res, next) {
  req.id = req.headers["x-request-id"] || randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
}

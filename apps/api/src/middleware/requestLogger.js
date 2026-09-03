// A tiny logger, not the full `utils/logger.js` (that comes later on Day 10).
// Every request gets one line: method, path, status, how long it took, and
// the correlation id (see middleware/requestId.js) — never the body, which
// is how a prompt's content could otherwise end up in these logs.
export function requestLogger(req, res, next) {
  const startedAt = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    console.log(`[${req.id}] ${req.method} ${req.originalUrl} → ${res.statusCode} (${durationMs}ms)`);
  });

  next();
}
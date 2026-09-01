// A tiny logger, not the full `utils/logger.js` (that comes later on Day 10).
// Every request gets one line: method, path, status, and how long it took.
export function requestLogger(req, res, next) {
  const startedAt = Date.now();

  res.on("finish", () => {
    const durationMs = Date.now() - startedAt;
    console.log(`${req.method} ${req.originalUrl} → ${res.statusCode} (${durationMs}ms)`);
  });

  next();
}
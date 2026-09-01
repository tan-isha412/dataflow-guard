// A minimal structured logger — every line is one JSON object, which
// is what lets log aggregation tools (or just `grep`) filter by level
// or field later. Not fancy on purpose; Day 18's monitoring setup can
// swap this out without touching any file that imports { logger }.
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const currentLevel = LEVELS[process.env.LOG_LEVEL] ?? LEVELS.info;

function log(level, message, meta = {}) {
  if (LEVELS[level] < currentLevel) return;
  console.log(JSON.stringify({ level, message, ...meta, timestamp: new Date().toISOString() }));
}

export const logger = {
  debug: (message, meta) => log("debug", message, meta),
  info: (message, meta) => log("info", message, meta),
  warn: (message, meta) => log("warn", message, meta),
  error: (message, meta) => log("error", message, meta)
};
// Every strategy shares the shape (detection, originalValue) => string,
// same idea as the detector shape from Day 6 — swappable pieces.
export function fullReplacementStrategy(detection) {
  return `[${detection.type}_REDACTED]`;
}
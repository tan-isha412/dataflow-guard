import { DATA_TYPES, SENSITIVITY_LEVELS, DETECTION_METHODS } from "@dataflow-guardian/shared";

// A JWT is three base64url segments joined by dots: header.payload.signature.
// The header segment always starts with "eyJ" once base64-decoded
// (because it's always JSON starting with `{"`), which makes this
// pattern reliable without false-positiving on random dotted strings.
const JWT_PATTERN = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;

export function detectJwts(text) {
  const detections = [];
  for (const match of text.matchAll(JWT_PATTERN)) {
    detections.push({
      id: crypto.randomUUID(),
      type: DATA_TYPES.JWT,
      sensitivity: SENSITIVITY_LEVELS.HIGH,
      start: match.index,
      end: match.index + match[0].length,
      confidence: 0.9,
      method: DETECTION_METHODS.PATTERN,
      ruleId: "jwt-v1"
    });
  }
  return detections;
}
import { DATA_TYPES, SENSITIVITY_LEVELS, DETECTION_METHODS } from "@dataflow-guardian/shared";

// Catches the common "KEY = value" / "SECRET: value" shape that
// doesn't match any specific known format (unlike AWS keys or GitHub
// tokens, which have a fixed prefix). Deliberately lower confidence —
// this one guesses based on the LABEL next to a value, not the value's
// own shape, so it's more prone to false positives.
const GENERIC_SECRET_PATTERN = /\b(?:api[_-]?key|secret|token|password)\s*[:=]\s*["']?([A-Za-z0-9_-]{8,})["']?/gi;

export function detectGenericSecrets(text) {
  const detections = [];
  for (const match of text.matchAll(GENERIC_SECRET_PATTERN)) {
    detections.push({
      id: crypto.randomUUID(),
      type: DATA_TYPES.SECRET,
      sensitivity: SENSITIVITY_LEVELS.HIGH,
      start: match.index,
      end: match.index + match[0].length,
      confidence: 0.6,
      method: DETECTION_METHODS.PATTERN,
      ruleId: "generic-secret-v1"
    });
  }
  return detections;
}
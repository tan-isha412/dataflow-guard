import { DATA_TYPES, SENSITIVITY_LEVELS, DETECTION_METHODS } from "@dataflow-guardian/shared";

// AWS access key IDs always start with AKIA and are 20 chars total —
// this is a real, documented format, not a guess.
const AWS_KEY_PATTERN = /\bAKIA[0-9A-Z]{16}\b/g;

export function detectAwsKeys(text) {
  const detections = [];
  for (const match of text.matchAll(AWS_KEY_PATTERN)) {
    detections.push({
      id: crypto.randomUUID(),
      type: DATA_TYPES.AWS_ACCESS_KEY,
      sensitivity: SENSITIVITY_LEVELS.CRITICAL,
      start: match.index,
      end: match.index + match[0].length,
      confidence: 0.99,
      method: DETECTION_METHODS.PATTERN,
      ruleId: "aws-access-key-v1"
    });
  }
  return detections;
}
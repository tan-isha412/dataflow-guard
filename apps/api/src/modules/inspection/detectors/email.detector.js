import { DATA_TYPES, SENSITIVITY_LEVELS, DETECTION_METHODS } from "@dataflow-guardian/shared";

const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Every detector shares this shape: takes raw text, returns an array
// of Detection objects with exact character offsets — the offsets
// are what redaction.service.js (Day 9) will use to replace text
// without corrupting anything around it.
export function detectEmails(text) {
  const detections = [];
  for (const match of text.matchAll(EMAIL_PATTERN)) {
    detections.push({
      id: crypto.randomUUID(),
      type: DATA_TYPES.EMAIL,
      sensitivity: SENSITIVITY_LEVELS.MEDIUM,
      start: match.index,
      end: match.index + match[0].length,
      confidence: 0.95,
      method: DETECTION_METHODS.PATTERN,
      ruleId: "email-v1"
    });
  }
  return detections;
}
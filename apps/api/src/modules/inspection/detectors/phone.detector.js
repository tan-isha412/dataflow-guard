import { DATA_TYPES, SENSITIVITY_LEVELS, DETECTION_METHODS } from "@dataflow-guardian/shared";

// Deliberately loose (matches +91-XXXXXXXXXX, (555) 123-4567, etc.)
// — phone formats vary too much globally to nail with one regex.
// Confidence is set lower than email for exactly that reason.
const PHONE_PATTERN = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;

export function detectPhoneNumbers(text) {
  const detections = [];
  for (const match of text.matchAll(PHONE_PATTERN)) {
    detections.push({
      id: crypto.randomUUID(),
      type: DATA_TYPES.PHONE,
      sensitivity: SENSITIVITY_LEVELS.MEDIUM,
      start: match.index,
      end: match.index + match[0].length,
      confidence: 0.75,
      method: DETECTION_METHODS.PATTERN,
      ruleId: "phone-v1"
    });
  }
  return detections;
}
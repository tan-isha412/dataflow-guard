import { DATA_TYPES, SENSITIVITY_LEVELS, DETECTION_METHODS } from "@dataflow-guardian/shared";
import { isValidLuhn } from "./luhn.util.js";

// 13-19 digits, optionally separated by spaces or dashes — matches
// candidates first, THEN verifies with Luhn. This two-step approach
// (regex finds candidates, a validator confirms them) is why this
// file needs luhn.util.js and the phone/email detectors don't.
const CANDIDATE_PATTERN = /\b(?:\d[ -]?){13,19}\b/g;

export function detectCreditCards(text) {
  const detections = [];

  for (const match of text.matchAll(CANDIDATE_PATTERN)) {
    const digitsOnly = match[0].replace(/[ -]/g, "");

    if (digitsOnly.length >= 13 && digitsOnly.length <= 19 && isValidLuhn(digitsOnly)) {
      detections.push({
        id: crypto.randomUUID(),
        type: DATA_TYPES.CREDIT_CARD,
        sensitivity: SENSITIVITY_LEVELS.CRITICAL,
        start: match.index,
        end: match.index + match[0].length,
        confidence: 0.98,
        method: DETECTION_METHODS.VALIDATOR,
        ruleId: "credit-card-luhn-v1"
      });
    }
  }

  return detections;
}
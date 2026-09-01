import { DATA_TYPES } from "@dataflow-guardian/shared";
import { fullReplacementStrategy } from "./strategies/fullReplacement.js";
import { partialMaskStrategy } from "./strategies/partialMask.js";
import { hashStrategy } from "./strategies/hash.js";

// Which strategy applies to which data type. Anything not listed
// falls back to full replacement — the safest default.
const STRATEGY_BY_TYPE = {
  [DATA_TYPES.CREDIT_CARD]: partialMaskStrategy,
  [DATA_TYPES.PHONE]: partialMaskStrategy,
  [DATA_TYPES.EMAIL]: partialMaskStrategy
};

export function redactContent(text, detections) {
  // THE key line: sort by start DESCENDING. If you replaced
  // left-to-right instead, the first replacement (e.g. "[EMAIL_REDACTED]"
  // being longer or shorter than the original email) would shift every
  // position after it — so the SECOND detection's start/end would now
  // point at the wrong characters. Right-to-left avoids that entirely,
  // because each replacement only affects text to its own right.
  const sortedByStartDescending = [...detections].sort((a, b) => b.start - a.start);

  let result = text;
  for (const detection of sortedByStartDescending) {
    const originalValue = text.slice(detection.start, detection.end);
    const strategy = STRATEGY_BY_TYPE[detection.type] ?? fullReplacementStrategy;
    const replacement = strategy(detection, originalValue);
    result = result.slice(0, detection.start) + replacement + result.slice(detection.end);
  }
  return result;
}
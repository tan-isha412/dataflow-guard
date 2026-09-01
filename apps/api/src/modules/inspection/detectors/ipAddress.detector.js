import { DATA_TYPES, SENSITIVITY_LEVELS, DETECTION_METHODS } from "@dataflow-guardian/shared";

// Matches IPv4 only. Each octet 0-255, checked with a proper range
// pattern instead of just \d{1,3} — otherwise "999.999.999.999"
// would incorrectly match.
const IPV4_PATTERN = /\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b/g;

export function detectIpAddresses(text) {
  const detections = [];
  for (const match of text.matchAll(IPV4_PATTERN)) {
    detections.push({
      id: crypto.randomUUID(),
      type: DATA_TYPES.IP_ADDRESS,
      sensitivity: SENSITIVITY_LEVELS.LOW,
      start: match.index,
      end: match.index + match[0].length,
      confidence: 0.9,
      method: DETECTION_METHODS.PATTERN,
      ruleId: "ip-address-v1"
    });
  }
  return detections;
}
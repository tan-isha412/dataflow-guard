import { DATA_TYPES, SENSITIVITY_LEVELS, DETECTION_METHODS } from "@dataflow-guardian/shared";

// Matches postgres://, mysql://, mongodb://, redis:// connection
// strings — these almost always embed a username:password, which
// is why they're CRITICAL, not just "a URL."
const DB_CONN_PATTERN = /\b(postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s"']+/g;

export function detectDbConnectionStrings(text) {
  const detections = [];
  for (const match of text.matchAll(DB_CONN_PATTERN)) {
    detections.push({
      id: crypto.randomUUID(),
      type: DATA_TYPES.DATABASE_CONNECTION_STRING,
      sensitivity: SENSITIVITY_LEVELS.CRITICAL,
      start: match.index,
      end: match.index + match[0].length,
      confidence: 0.95,
      method: DETECTION_METHODS.PATTERN,
      ruleId: "db-conn-string-v1"
    });
  }
  return detections;
}
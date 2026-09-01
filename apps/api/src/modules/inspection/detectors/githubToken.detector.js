import { DATA_TYPES, SENSITIVITY_LEVELS, DETECTION_METHODS } from "@dataflow-guardian/shared";

// Covers the modern GitHub token prefixes: ghp_ (personal),
// gho_ (oauth), ghu_ (user-to-server), ghs_ (server-to-server).
const GITHUB_TOKEN_PATTERN = /\bgh[pousr]_[A-Za-z0-9]{36}\b/g;

export function detectGithubTokens(text) {
  const detections = [];
  for (const match of text.matchAll(GITHUB_TOKEN_PATTERN)) {
    detections.push({
      id: crypto.randomUUID(),
      type: DATA_TYPES.GITHUB_TOKEN,
      sensitivity: SENSITIVITY_LEVELS.CRITICAL,
      start: match.index,
      end: match.index + match[0].length,
      confidence: 0.99,
      method: DETECTION_METHODS.PATTERN,
      ruleId: "github-token-v1"
    });
  }
  return detections;
}
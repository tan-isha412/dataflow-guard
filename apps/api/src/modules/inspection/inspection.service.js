import { runAllDetectors } from "./detectors/registry.js";
import { detectCustomPatterns } from "./detectors/customPattern.detector.js";

// customRules will come from the database (Day 8's policy work) —
// hardcoded empty for now, wired up properly once policies exist.
export function detectSensitiveData(content, customRules = []) {
  const results = [
    ...runAllDetectors(content),
    ...detectCustomPatterns(content, customRules)
  ];
  return results.sort((a, b) => a.start - b.start);
}
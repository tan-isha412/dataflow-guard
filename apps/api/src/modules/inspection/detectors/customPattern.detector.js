import { DATA_TYPES, DETECTION_METHODS } from "@dataflow-guardian/shared";

// This detector is different on purpose: it doesn't have ONE fixed
// pattern baked in. Instead, it takes a list of org-defined patterns
// (built on Day 8's policy work) and applies each one. This is what
// lets a customer say "also flag any string matching EMP-\d{6}" for
// their internal employee IDs without you writing new code.
export function detectCustomPatterns(text, customRules = []) {
  const detections = [];

  for (const rule of customRules) {
    const pattern = new RegExp(rule.pattern, "g");
    for (const match of text.matchAll(pattern)) {
      detections.push({
        id: crypto.randomUUID(),
        type: DATA_TYPES.CUSTOM,
        sensitivity: rule.sensitivity,
        start: match.index,
        end: match.index + match[0].length,
        confidence: rule.confidence ?? 0.8,
        method: DETECTION_METHODS.CUSTOM_RULE,
        ruleId: rule.id
      });
    }
  }

  return detections;
}
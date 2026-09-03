// A pure function — same input always gives the same output, no
// side effects. That's what makes it trivially testable without a
// database or mocks.
const SENSITIVITY_WEIGHTS = { LOW: 1, MEDIUM: 3, HIGH: 7, CRITICAL: 15 };

// Explainable inputs only, per the Phase 7 spec: detection severity +
// destination risk. Nothing fancier — no multipliers, no decay curves.
const DESTINATION_RISK_WEIGHTS = { LOW: 0, MEDIUM: 5, HIGH: 15, CRITICAL: 30 };

export function calculateRiskScore(detections, destinationContext = null) {
  const detectionScore = detections.reduce((sum, d) => sum + (SENSITIVITY_WEIGHTS[d.sensitivity] ?? 0), 0);
  const destinationScore = DESTINATION_RISK_WEIGHTS[destinationContext?.riskLevel] ?? 0;
  // capped so one huge blob of text (or a maximally-risky destination)
  // can't produce a meaningless score like 4000
  return Math.min(100, detectionScore + destinationScore);
}
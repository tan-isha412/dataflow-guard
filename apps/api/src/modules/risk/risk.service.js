// A pure function — same input always gives the same output, no
// side effects. That's what makes it trivially testable without a
// database or mocks.
const SENSITIVITY_WEIGHTS = { LOW: 1, MEDIUM: 3, HIGH: 7, CRITICAL: 15 };

export function calculateRiskScore(detections) {
  if (detections.length === 0) return 0;
  const total = detections.reduce((sum, d) => sum + (SENSITIVITY_WEIGHTS[d.sensitivity] ?? 0), 0);
  return Math.min(100, total); // capped so one huge blob of text can't produce a meaningless score like 4000
}
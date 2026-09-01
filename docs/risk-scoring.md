# Risk Scoring

Each detection is weighted by sensitivity: LOW=1, MEDIUM=3, HIGH=7,
CRITICAL=15. A scan's total risk score is the sum of all detection
weights, capped at 100. See `apps/api/src/modules/risk/risk.service.js`.

This is deliberately simple (linear, capped) rather than a trained
model — it's fully explainable to a customer asking "why did this
score 47," which matters more for this product's trust story than
marginal scoring accuracy would.
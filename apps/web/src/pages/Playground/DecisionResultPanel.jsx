const ACTION_LABELS = {
  ALLOW: "Allowed", REDACT: "Redacted", BLOCK: "Blocked", REQUIRE_APPROVAL: "Needs Approval"
};

export function DecisionResultPanel({ decision }) {
  return (
    <div className="decision-result-panel">
      <h2>{ACTION_LABELS[decision.action]}</h2>
      <p>Risk score: {decision.riskScore}</p>
      <p>{decision.reason}</p>
      {decision.matchedPolicies?.length > 0 && (
        <p>Policy: {decision.matchedPolicies.map((p) => p.name || p.id).join(", ")}</p>
      )}
      {decision.destination?.destinationType && <p>Destination risk: {decision.destination.riskLevel}</p>}
      {decision.sanitizedContent && (
        <div>
          <h3>Sanitized content</h3>
          <pre>{decision.sanitizedContent}</pre>
        </div>
      )}
    </div>
  );
}
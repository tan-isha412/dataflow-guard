const ACTION_LABELS = {
  ALLOW: "Allowed", REDACT: "Redacted", BLOCK: "Blocked", REQUIRE_APPROVAL: "Needs Approval"
};

export function DecisionResultPanel({ decision }) {
  return (
    <div className="decision-result-panel">
      <h2>{ACTION_LABELS[decision.action]}</h2>
      <p>Risk score: {decision.riskScore}</p>
      <p>{decision.reason}</p>
      {decision.sanitizedContent && (
        <div>
          <h3>Sanitized content</h3>
          <pre>{decision.sanitizedContent}</pre>
        </div>
      )}
    </div>
  );
}
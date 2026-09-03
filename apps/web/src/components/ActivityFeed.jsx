const ACTION_TONE = {
  INSPECTION_ALLOW: "green",
  INSPECTION_REDACT: "orange",
  INSPECTION_BLOCK: "red",
  INSPECTION_REQUIRE_APPROVAL: "orange",
  APPROVAL_GRANTED: "green",
  APPROVAL_REJECTED: "red",
  POLICY_CREATED: "gray"
};

const EVENT_LABELS = {
  INSPECTION_ALLOW: "Allowed",
  INSPECTION_REDACT: "Redacted",
  INSPECTION_BLOCK: "Blocked",
  INSPECTION_REQUIRE_APPROVAL: "Approval required",
  APPROVAL_GRANTED: "Approval granted",
  APPROVAL_REJECTED: "Approval rejected",
  POLICY_CREATED: "Policy created"
};

// Renders exactly what's in AuditEvent.metadata — detection TYPES,
// policy names, a risk score, a destination id. Never raw prompt
// content: there is none in this table to begin with (see
// docs/privacy.md), so there's nothing here to accidentally leak.
export function ActivityFeed({ events }) {
  if (!events.length) return <p>No security activity yet.</p>;

  return (
    <ul className="activity-feed">
      {events.map((event) => (
        <li key={event.id} className="activity-item">
          <div className="activity-item-header">
            <span className="activity-label" style={{ color: colorFor(event.eventType) }}>
              {EVENT_LABELS[event.eventType] ?? event.eventType}
            </span>
            <time>{new Date(event.createdAt).toLocaleString()}</time>
          </div>
          <div className="activity-item-body">
            {event.actor && <span>{event.actor.fullName} ({event.actor.email})</span>}
            {event.metadata?.destinationId && <span>→ {event.metadata.destinationId}</span>}
            {event.metadata?.detectionTypes?.length > 0 && <span>Detected: {event.metadata.detectionTypes.join(", ")}</span>}
            {typeof event.metadata?.riskScore === "number" && <span>Risk: {event.metadata.riskScore}</span>}
            {event.metadata?.matchedPolicies?.length > 0 && (
              <span>Policy: {event.metadata.matchedPolicies.map((p) => p.name || p.id).join(", ")}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function colorFor(eventType) {
  return { green: "#15803d", red: "#b91c1c", orange: "#b45309", gray: "#6b7280" }[ACTION_TONE[eventType] ?? "gray"];
}

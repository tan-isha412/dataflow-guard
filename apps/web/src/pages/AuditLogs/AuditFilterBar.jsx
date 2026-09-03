export function AuditFilterBar({ eventType, onEventTypeChange }) {
  const EVENT_TYPES = [
    "",
    "INSPECTION_ALLOW",
    "INSPECTION_REDACT",
    "INSPECTION_BLOCK",
    "INSPECTION_REQUIRE_APPROVAL",
    "APPROVAL_GRANTED",
    "APPROVAL_REJECTED",
    "POLICY_CREATED"
  ];

  return (
    <select value={eventType} onChange={(e) => onEventTypeChange(e.target.value)}>
      {EVENT_TYPES.map((type) => (
        <option key={type} value={type}>{type || "All events"}</option>
      ))}
    </select>
  );
}
export function AuditFilterBar({ eventType, onEventTypeChange }) {
  const EVENT_TYPES = ["", "POLICY_CREATED", "APPROVAL_GRANTED", "APPROVAL_REJECTED", "INSPECTION_PERFORMED"];

  return (
    <select value={eventType} onChange={(e) => onEventTypeChange(e.target.value)}>
      {EVENT_TYPES.map((type) => (
        <option key={type} value={type}>{type || "All events"}</option>
      ))}
    </select>
  );
}
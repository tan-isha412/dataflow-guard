const BADGE_COLORS = { APPROVED: "green", UNAPPROVED: "gray", PENDING_REVIEW: "orange", BLOCKED: "red" };

export function Badge({ status, children }) {
  return (
    <span className="badge" style={{ backgroundColor: BADGE_COLORS[status] ?? "gray" }}>
      {children ?? status}
    </span>
  );
}
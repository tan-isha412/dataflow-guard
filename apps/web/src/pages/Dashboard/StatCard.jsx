export function StatCard({ label, value, tone = "neutral" }) {
  return (
    <div className={`stat-card stat-card-${tone}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}
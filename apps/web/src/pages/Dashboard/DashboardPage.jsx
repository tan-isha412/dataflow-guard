import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../api/client.js";
import { getDashboardSummary, listAuditEvents } from "../../api/endpoints/audit.js";
import { StatCard } from "./StatCard.jsx";
import { RiskChart } from "./RiskChart.jsx";
import { DataTypesChart } from "./DataTypesChart.jsx";
import { ActivityFeed } from "../../components/ActivityFeed.jsx";

// The security overview: every number and row on this page comes from
// a real backend query scoped to the authenticated org (req.auth.
// organizationId server-side) — nothing here is sample/decorative data.
export function DashboardPage() {
  const { data: summary, isLoading: summaryLoading, isError: summaryError } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: getDashboardSummary
  });

  const { data: riskOverTime = [] } = useQuery({
    queryKey: ["analytics", "risk-over-time"],
    queryFn: () => apiClient.get("/analytics/risk-over-time").then((r) => r.data)
  });

  const { data: detectionsByType = [] } = useQuery({
    queryKey: ["analytics", "detections-by-type"],
    queryFn: () => apiClient.get("/analytics/detections-by-type").then((r) => r.data)
  });

  const { data: recentActivity = [], isLoading: activityLoading } = useQuery({
    queryKey: ["audit-events", "recent"],
    queryFn: () => listAuditEvents({ take: 10 })
  });

  if (summaryError) return <p>Could not load the dashboard. Try refreshing.</p>;

  return (
    <div>
      <h1>Security Overview</h1>

      {summaryLoading || !summary ? (
        <p>Loading...</p>
      ) : (
        <div className="stat-grid">
          <StatCard label="Requests inspected" value={summary.totalScans} />
          <StatCard label="Allowed" value={summary.allowedCount} tone="positive" />
          <StatCard label="Blocked" value={summary.blockedCount} tone="negative" />
          <StatCard label="Redacted" value={summary.redactedCount} tone="warning" />
          <StatCard label="Pending approval" value={summary.pendingApprovals} tone="warning" />
          <StatCard label="High-risk requests" value={summary.highRiskCount} tone="negative" />
          <StatCard label="Avg. risk score" value={summary.avgRiskScore} />
          <StatCard label={`Active users (${summary.windowDays}d)`} value={summary.activeUsers} />
          <StatCard label={`Destinations seen (${summary.windowDays}d)`} value={summary.destinations.length} />
        </div>
      )}

      {summary?.destinations.length > 0 && (
        <p className="destinations-seen-list">Destinations: {summary.destinations.join(", ")}</p>
      )}

      <div className="dashboard-charts">
        <div>
          <h2>Risk score, last 30 days</h2>
          <RiskChart data={riskOverTime} />
        </div>
        <div>
          <h2>Detections by type</h2>
          <DataTypesChart data={detectionsByType} />
        </div>
      </div>

      <h2>Recent activity</h2>
      {activityLoading ? <p>Loading...</p> : <ActivityFeed events={recentActivity} />}
    </div>
  );
}

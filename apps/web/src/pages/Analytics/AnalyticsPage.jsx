import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../api/client.js";
import { RiskChart } from "../Dashboard/RiskChart.jsx";
import { DataTypesChart } from "../Dashboard/DataTypesChart.jsx";

// Reuses the SAME chart components from Day 13's Dashboard — they
// were written to just take a `data` prop, so a page dedicated to
// deeper analytics doesn't need new chart code, only new data fetching.
export function AnalyticsPage() {
  const { data: riskOverTime = [], isLoading: riskLoading, isError: riskError } = useQuery({
    queryKey: ["analytics", "risk-over-time"],
    queryFn: () => apiClient.get("/analytics/risk-over-time").then((r) => r.data)
  });

  const { data: detectionsByType = [], isLoading: detectionsLoading, isError: detectionsError } = useQuery({
    queryKey: ["analytics", "detections-by-type"],
    queryFn: () => apiClient.get("/analytics/detections-by-type").then((r) => r.data)
  });

  return (
    <div>
      <h1>Analytics</h1>
      <h2>Risk score, last 30 days</h2>
      {riskLoading ? (
        <p>Loading...</p>
      ) : riskError ? (
        <p>Could not load risk analytics. Try refreshing.</p>
      ) : riskOverTime.length === 0 ? (
        <p>No inspections in the last 30 days yet.</p>
      ) : (
        <RiskChart data={riskOverTime} />
      )}
      <h2>Detections by type</h2>
      {detectionsLoading ? (
        <p>Loading...</p>
      ) : detectionsError ? (
        <p>Could not load detection analytics. Try refreshing.</p>
      ) : detectionsByType.length === 0 ? (
        <p>No sensitive data detections recorded yet.</p>
      ) : (
        <DataTypesChart data={detectionsByType} />
      )}
    </div>
  );
}
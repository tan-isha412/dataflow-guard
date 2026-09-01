import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../api/client.js";
import { RiskChart } from "../Dashboard/RiskChart.jsx";
import { DataTypesChart } from "../Dashboard/DataTypesChart.jsx";

// Reuses the SAME chart components from Day 13's Dashboard — they
// were written to just take a `data` prop, so a page dedicated to
// deeper analytics doesn't need new chart code, only new data fetching.
export function AnalyticsPage() {
  const { data: riskOverTime = [] } = useQuery({
    queryKey: ["analytics", "risk-over-time"],
    queryFn: () => apiClient.get("/analytics/risk-over-time").then((r) => r.data)
  });

  const { data: detectionsByType = [] } = useQuery({
    queryKey: ["analytics", "detections-by-type"],
    queryFn: () => apiClient.get("/analytics/detections-by-type").then((r) => r.data)
  });

  return (
    <div>
      <h1>Analytics</h1>
      <h2>Risk score, last 30 days</h2>
      <RiskChart data={riskOverTime} />
      <h2>Detections by type</h2>
      <DataTypesChart data={detectionsByType} />
    </div>
  );
}
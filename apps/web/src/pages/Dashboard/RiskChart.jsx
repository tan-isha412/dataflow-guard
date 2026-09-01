import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// Expects data shaped [{ date: "2026-08-01", avgRiskScore: 42 }, ...]
// — this component doesn't fetch anything itself, it just renders
// whatever DashboardPage hands it. Keeping charts "dumb" like this
// makes them reusable and trivially testable with fake data.
export function RiskChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis domain={[0, 100]} />
        <Tooltip />
        <Line type="monotone" dataKey="avgRiskScore" stroke="#e11d48" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
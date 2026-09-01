import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

// Expects data shaped [{ type: "EMAIL", count: 34 }, ...]
export function DataTypesChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={data}>
        <XAxis dataKey="type" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="count" fill="#4f46e5" />
      </BarChart>
    </ResponsiveContainer>
  );
}
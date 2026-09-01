import { useQuery } from "@tanstack/react-query";
import { listDestinations } from "../../api/endpoints/destinations.js";
import { Table } from "../../components/ui/Table.jsx";
import { Badge } from "../../components/ui/Badge.jsx";

// Columns are just data describing what to show — this is the
// "render prop" pattern: the Status column doesn't render plain
// text, it renders a <Badge>, decided right here, not inside Table.jsx.
const columns = [
  { key: "name", label: "Name" },
  { key: "type", label: "Type" },
  { key: "status", label: "Status", render: (row) => <Badge status={row.status} /> },
  { key: "riskLevel", label: "Risk" }
];

export function DestinationsPage() {
  const { data: destinations = [], isLoading } = useQuery({
    queryKey: ["destinations"],
    queryFn: listDestinations
  });

  if (isLoading) return <p>Loading destinations...</p>;

  return (
    <div>
      <h1>Destinations</h1>
      <Table columns={columns} rows={destinations} rowKey="id" />
    </div>
  );
}
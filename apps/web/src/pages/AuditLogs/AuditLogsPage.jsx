import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listAuditEvents } from "../../api/endpoints/audit.js";
import { Table } from "../../components/ui/Table.jsx";
import { AuditFilterBar } from "./AuditFilterBar.jsx";

const columns = [
  { key: "eventType", label: "Event" },
  { key: "createdAt", label: "When", render: (row) => new Date(row.createdAt).toLocaleString() },
  { key: "actorUserId", label: "Actor" }
];

export function AuditLogsPage() {
  const [eventType, setEventType] = useState("");
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["audit-events", eventType],
    queryFn: () => listAuditEvents({ eventType: eventType || undefined })
  });

  return (
    <div>
      <div className="page-header">
        <h1>Audit Logs</h1>
        <AuditFilterBar eventType={eventType} onEventTypeChange={setEventType} />
      </div>
      {isLoading ? <p>Loading...</p> : <Table columns={columns} rows={events} rowKey="id" />}
    </div>
  );
}
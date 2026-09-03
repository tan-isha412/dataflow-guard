import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listAuditEvents } from "../../api/endpoints/audit.js";
import { ActivityFeed } from "../../components/ActivityFeed.jsx";
import { AuditFilterBar } from "./AuditFilterBar.jsx";

export function AuditLogsPage() {
  const [eventType, setEventType] = useState("");
  const { data: events = [], isLoading, isError } = useQuery({
    queryKey: ["audit-events", eventType],
    queryFn: () => listAuditEvents({ eventType: eventType || undefined, take: 100 })
  });

  return (
    <div>
      <div className="page-header">
        <h1>Audit Logs</h1>
        <AuditFilterBar eventType={eventType} onEventTypeChange={setEventType} />
      </div>
      {isError && <p>Could not load audit events. Try refreshing.</p>}
      {isLoading ? <p>Loading...</p> : <ActivityFeed events={events} />}
    </div>
  );
}
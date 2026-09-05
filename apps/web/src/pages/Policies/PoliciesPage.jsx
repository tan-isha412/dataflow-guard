import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listPolicies } from "../../api/endpoints/policies.js";
import { Table } from "../../components/ui/Table.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Modal } from "../../components/ui/Modal.jsx";
import { PolicyForm } from "./PolicyForm.jsx";

// Matches the label wording an employee actually sees on a decision
// (DecisionResultPanel.jsx, the extension's panel) rather than the raw
// enum value the API uses internally — an admin configuring "REQUIRE_
// APPROVAL" as a setting name is fine, but a table of existing policies
// reads better as prose.
const ACTION_LABELS = { ALLOW: "Allow", REDACT: "Redact", BLOCK: "Block", REQUIRE_APPROVAL: "Require approval" };

const columns = [
  { key: "name", label: "Name" },
  { key: "priority", label: "Priority" },
  { key: "action", label: "Action", render: (row) => ACTION_LABELS[row.action] ?? row.action },
  { key: "enabled", label: "Enabled", render: (row) => (row.enabled ? "Yes" : "No") }
];

export function PoliciesPage() {
  const [isModalOpen, setModalOpen] = useState(false);
  const { data: policies = [], isLoading } = useQuery({
    queryKey: ["policies"],
    queryFn: listPolicies
  });

  return (
    <div>
      <div className="page-header">
        <h1>Policies</h1>
        <Button onClick={() => setModalOpen(true)}>+ New policy</Button>
      </div>

      {isLoading ? <p>Loading...</p> : <Table columns={columns} rows={policies} rowKey="id" emptyMessage="No policies yet — create one to start enforcing rules on what employees can send." />}

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Create policy">
        <PolicyForm onSuccess={() => setModalOpen(false)} />
      </Modal>
    </div>
  );
}
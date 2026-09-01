import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listPolicies } from "../../api/endpoints/policies.js";
import { Table } from "../../components/ui/Table.jsx";
import { Button } from "../../components/ui/Button.jsx";
import { Modal } from "../../components/ui/Modal.jsx";
import { PolicyForm } from "./PolicyForm.jsx";

const columns = [
  { key: "name", label: "Name" },
  { key: "priority", label: "Priority" },
  { key: "action", label: "Action" },
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

      {isLoading ? <p>Loading...</p> : <Table columns={columns} rows={policies} rowKey="id" />}

      <Modal isOpen={isModalOpen} onClose={() => setModalOpen(false)} title="Create policy">
        <PolicyForm onSuccess={() => setModalOpen(false)} />
      </Modal>
    </div>
  );
}
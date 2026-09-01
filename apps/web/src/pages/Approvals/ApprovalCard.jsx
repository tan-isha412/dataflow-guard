import { useMutation, useQueryClient } from "@tanstack/react-query";
import { decideApproval } from "../../api/endpoints/approvals.js";
import { Card } from "../../components/ui/Card.jsx";
import { Button } from "../../components/ui/Button.jsx";

export function ApprovalCard({ approval }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (decision) => decideApproval(approval.id, decision),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["approvals"] })
  });

  return (
    <Card title={`Approval — ${approval.status}`}>
      <p>{approval.reason}</p>
      <p>Requested: {new Date(approval.createdAt).toLocaleString()}</p>
      {approval.status === "PENDING" && (
        <div className="approval-actions">
          <Button onClick={() => mutation.mutate("APPROVED")} disabled={mutation.isPending}>Approve</Button>
          <Button variant="danger" onClick={() => mutation.mutate("REJECTED")} disabled={mutation.isPending}>Reject</Button>
        </div>
      )}
    </Card>
  );
}
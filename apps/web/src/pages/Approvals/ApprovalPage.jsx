import { useQuery } from "@tanstack/react-query";
import { listApprovals } from "../../api/endpoints/approvals.js";
import { ApprovalCard } from "./ApprovalCard.jsx";

export function ApprovalsPage() {
  const { data: approvals = [], isLoading } = useQuery({
    queryKey: ["approvals"],
    queryFn: () => listApprovals()
  });

  if (isLoading) return <p>Loading approvals...</p>;

  return (
    <div>
      <h1>Approvals</h1>
      {approvals.length === 0 && <p>No approvals yet.</p>}
      {approvals.map((approval) => <ApprovalCard key={approval.id} approval={approval} />)}
    </div>
  );
}
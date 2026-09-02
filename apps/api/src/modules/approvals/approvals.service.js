import { AppError } from "../../middleware/errorHandler.js";
import * as approvalsRepository from "./approvals.repository.js";
import { emitAuditEvent } from "../audit/audit.emitter.js";
import { scheduleApprovalExpiry } from "../../queue/queues.js";
const APPROVAL_EXPIRY_HOURS = 24;
const APPROVAL_EXPIRY_MS = APPROVAL_EXPIRY_HOURS * 60 * 60 * 1000;


// Fixed set of allowed transitions — a state machine encoded as
// data. PENDING can move to any of these three; the other three are
// terminal (empty array = nowhere else to go).
const VALID_TRANSITIONS = {
  PENDING: ["APPROVED", "REJECTED", "EXPIRED"],
  APPROVED: [],
  REJECTED: [],
  EXPIRED: []
};

export async function createApprovalRequest({ organizationId, requestedByUserId, reason, detections, destinationId }) {
  const expiresAt = new Date(Date.now() + APPROVAL_EXPIRY_HOURS * 60 * 60 * 1000);
  const approval = await approvalsRepository.createApprovalRequest({
    organizationId,
    requestedByUserId,
    status: "PENDING",
    reason,
    detections,
    destinationId,
    expiresAt
  });
  await scheduleApprovalExpiry(approval.id, APPROVAL_EXPIRY_MS);
  return approval;
}

export async function listApprovals(organizationId, filters) {
  return approvalsRepository.findApprovalsByOrganization(organizationId, filters);
}

export async function decideApproval(organizationId, approvalId, decision, decidedByUserId) {
  const approval = await approvalsRepository.findApprovalById(approvalId);

  if (!approval || approval.organizationId !== organizationId) {
    throw new AppError("Approval not found", 404, "APPROVAL_NOT_FOUND");
  }

  if (!VALID_TRANSITIONS[approval.status].includes(decision)) {
    throw new AppError(`Cannot move from ${approval.status} to ${decision}`, 400, "INVALID_TRANSITION");
  }

  const r=approvalsRepository.updateApproval(approvalId, {
    status: decision,
    decidedByUserId,
    decidedAt: new Date()
  });
  await emitAuditEvent({
  organizationId,
  actorUserId: decidedByUserId,
  eventType: decision === "APPROVED" ? "APPROVAL_GRANTED" : "APPROVAL_REJECTED",
  metadata: { approvalId }
});
return r;
}
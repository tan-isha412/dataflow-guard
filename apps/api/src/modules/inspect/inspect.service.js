import { detectSensitiveData } from "../inspection/inspection.service.js";
import { calculateRiskScore } from "../risk/risk.service.js";
import { listPolicies } from "../policy/policy.service.js";
import { makeDecision } from "../decision/decision.service.js";
import { createDecisionRecord } from "../decision/decision.repository.js";
import { createApprovalRequest } from "../approvals/approvals.service.js";
import { DECISION_ACTIONS } from "@dataflow-guardian/shared";
import { logger } from "../../../utils/logger.js";
import { truncateForAudit } from "../../../utils/crypto.js";

// This is the ENTIRE pipeline in one place, in the correct order:
// detect → score risk → fetch rules → decide → persist → (create an
// approval request if required) → log. Every piece was already built
// and tested independently on Days 6-9 — this function just calls
// them in sequence. requestedByUserId/destinationId are Phase 5
// additions: the former is needed to attribute an approval request to
// someone, the latter just tags which extension-reported destination
// (e.g. "chatgpt") triggered it — see Approval.destinationId, which is
// a free-form string, not a foreign key, so no Destination row lookup
// is required here.
export async function runInspection({ organizationId, requestedByUserId, content, destinationId }) {
  const detections = detectSensitiveData(content);
  const policies = await listPolicies(organizationId);
  const riskScore = calculateRiskScore(detections);

  const decision = await makeDecision({ content, detections, policies, riskScore });

  await createDecisionRecord({
    organizationId,
    action: decision.action,
    status: decision.status,
    riskScore: decision.riskScore,
    reason: decision.reason,
    matchedPolicyIds: decision.matchedPolicyIds,
    detections: decision.detections,
    sanitizedContent: decision.sanitizedContent
  });

  if (decision.action === DECISION_ACTIONS.REQUIRE_APPROVAL) {
    const approval = await createApprovalRequest({
      organizationId,
      requestedByUserId,
      reason: decision.reason,
      detections: decision.detections,
      destinationId
    });
    decision.approvalRequestId = approval.id;
  }

  // Note: we log a TRUNCATED preview of the content, never the full
  // thing — the whole point of this system is not leaking sensitive
  // data, including into its own logs.
  logger.info("inspection completed", {
    organizationId,
    action: decision.action,
    detectionCount: detections.length,
    contentPreview: truncateForAudit(content, 50)
  });

  return decision;
}
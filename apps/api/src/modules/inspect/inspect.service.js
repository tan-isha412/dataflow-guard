import { detectSensitiveData } from "../inspection/inspection.service.js";
import { calculateRiskScore } from "../risk/risk.service.js";
import { listPolicies } from "../policy/policy.service.js";
import { resolveDestinationContext } from "../destinations/destinations.service.js";
import { makeDecision } from "../decision/decision.service.js";
import { createDecisionRecord } from "../decision/decision.repository.js";
import { createApprovalRequest } from "../approvals/approvals.service.js";
import { emitAuditEvent } from "../audit/audit.emitter.js";
import { DECISION_ACTIONS } from "@dataflow-guardian/shared";
import { logger } from "../../../utils/logger.js";

// This is the ENTIRE pipeline in one place, in the correct order:
// resolve destination -> (short-circuit if it's blocked outright) ->
// detect -> score risk -> fetch rules -> decide -> persist -> (create an
// approval request if required) -> audit -> log. Every piece was already
// built and tested independently on Days 6-9 — Phase 5/7 additions are
// destinationContext/userRole flowing into risk+policy, and requestId
// flowing into every log line for correlation (see middleware/requestId.js).
//
// Privacy note (Phase 6): nowhere in this file — or anywhere downstream —
// is `content` (or any detection's matched substring) passed to logger.*
// or emitAuditEvent. Only metadata (counts, types, ids, scores) is. An
// earlier version logged a "truncated" content preview; for short prompts
// (<= the truncation length) that truncation was a no-op, so it was
// removed outright rather than tuned — see docs/privacy.md.
export async function runInspection({ organizationId, requestedByUserId, userRole, content, destination, requestId }) {
  const destinationContext = await resolveDestinationContext(organizationId, destination);

  const decision = destinationContext.status === "BLOCKED"
    ? blockedDestinationDecision(destinationContext)
    : await evaluate({ content, organizationId, destinationContext, userRole });

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
      destinationId: destinationContext.destinationId
    });
    decision.approvalRequestId = approval.id;
  }

  decision.destination = {
    destinationId: destinationContext.destinationId,
    destinationType: destinationContext.destinationType,
    riskLevel: destinationContext.riskLevel
  };
  decision.requestId = requestId;

  // Feeds the existing /audit endpoint (and Phase 8's activity feed) —
  // metadata only, never content. detectionTypes/matchedPolicies are
  // already just labels (e.g. "EMAIL", "External AI Credential
  // Protection"), not the sensitive values that were detected.
  await emitAuditEvent({
    organizationId,
    actorUserId: requestedByUserId,
    eventType: `INSPECTION_${decision.action}`,
    metadata: {
      requestId,
      riskScore: decision.riskScore,
      destinationId: destinationContext.destinationId,
      destinationType: destinationContext.destinationType,
      detectionTypes: [...new Set(decision.detections.map((d) => d.type))],
      detectionCount: decision.detections.length,
      matchedPolicies: decision.matchedPolicies,
      approvalRequestId: decision.approvalRequestId
    }
  });

  logger.info("inspection completed", {
    requestId,
    organizationId,
    action: decision.action,
    detectionCount: decision.detections.length,
    riskScore: decision.riskScore,
    destinationId: destinationContext.destinationId
  });

  return decision;
}

async function evaluate({ content, organizationId, destinationContext, userRole }) {
  const detections = detectSensitiveData(content);
  const policies = await listPolicies(organizationId);
  const riskScore = calculateRiskScore(detections, destinationContext);
  return makeDecision({ content, detections, policies, riskScore, destinationContext, userRole });
}

// A destination an admin has explicitly blocked (Destinations page) is
// an unconditional stop — no need to run detection/policy at all, and
// no policy could ever override it (there's nothing to configure a
// policy against; "blocked" is a direct admin decision, not a rule).
function blockedDestinationDecision(destinationContext) {
  return {
    action: DECISION_ACTIONS.BLOCK,
    status: "FINAL",
    riskScore: 100,
    reason: `Destination "${destinationContext.destinationId}" is blocked by your organization.`,
    matchedPolicyIds: [],
    matchedPolicies: [],
    detections: [],
    sanitizedContent: null,
    approvalRequestId: null
  };
}

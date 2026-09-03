import { DECISION_ACTIONS } from "@dataflow-guardian/shared";
import { findMatchingPolicy } from "../policy/policy.evaluator.js";
import { resolveHighestPrecedence } from "./decision.precedence.js";
import { redactContent } from "../redaction/redaction.service.js";

// Pure logic — no database calls here on purpose. This function is
// pure business rules; decision.repository.js (below) is the only
// file that persists anything.
//
// destinationContext/userRole are optional (Phase 7 additions) so
// existing callers that only care about detection-driven policies keep
// working unchanged — see tests/unit/decision.service.test.js.
export async function makeDecision({ content, detections, policies, riskScore, destinationContext = null, userRole = null }) {
  const baseContext = {
    DESTINATION_ID: destinationContext?.destinationId ?? null,
    DESTINATION_TYPE: destinationContext?.destinationType ?? null,
    DESTINATION_RISK: destinationContext?.riskLevel ?? null,
    USER_ROLE: userRole,
    RISK_SCORE: riskScore
  };

  // Check EACH detection against the policies independently — one
  // piece of text might contain both a low-risk email (ALLOW) and a
  // credit card (BLOCK). Precedence resolves which one wins overall.
  const detectionMatches = detections.map((detection) => ({
    detection,
    policy: findMatchingPolicy(policies, { ...baseContext, DATA_TYPE: detection.type, SENSITIVITY: detection.sensitivity })
  }));

  // A policy can also be written purely in terms of destination/role/risk
  // ("require approval for any request to an unrecognized destination"),
  // with no DATA_TYPE condition at all — that needs a chance to match
  // even when nothing was detected in the content itself, so it's
  // evaluated once regardless of how many detections there were.
  const contextPolicy = findMatchingPolicy(policies, baseContext);
  const matches = contextPolicy
    ? [...detectionMatches, { detection: null, policy: contextPolicy }]
    : detectionMatches;

  const actions = matches.map((m) => m.policy?.action ?? DECISION_ACTIONS.ALLOW);
  const finalAction = resolveHighestPrecedence(actions.length ? actions : [DECISION_ACTIONS.ALLOW]);

  // Set, not array — if 3 detections all matched the same policy,
  // we only want that policy's id once in the response.
  const matchedPolicies = [...new Map(matches.filter((m) => m.policy).map((m) => [m.policy.id, m.policy])).values()]
    .map((p) => ({ id: p.id, name: p.name, action: p.action }));
  const matchedPolicyIds = matchedPolicies.map((p) => p.id);

  const sanitizedContent = finalAction === DECISION_ACTIONS.REDACT
    ? redactContent(content, detections)
    : null;

  return {
    action: finalAction,
    status: finalAction === DECISION_ACTIONS.REQUIRE_APPROVAL ? "PENDING" : "FINAL",
    riskScore,
    reason: buildReason(finalAction, matches),
    matchedPolicyIds,
    matchedPolicies,
    detections,
    sanitizedContent,
    approvalRequestId: null
  };
}

function buildReason(action, matches) {
  if (action === DECISION_ACTIONS.ALLOW) return "No policy violations detected.";
  const triggering = matches.filter((m) => m.policy?.action === action);
  const triggeringTypes = [...new Set(triggering.map((m) => m.detection?.type).filter(Boolean))];
  if (triggeringTypes.length) {
    return `${action} triggered by: ${triggeringTypes.join(", ")}`;
  }
  // A context-only match (destination/role/risk, no specific detection).
  const policyName = triggering[0]?.policy?.name;
  return policyName ? `${action} triggered by policy: ${policyName}` : `${action} triggered by organization policy.`;
}
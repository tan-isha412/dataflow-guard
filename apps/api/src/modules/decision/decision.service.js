import { DECISION_ACTIONS } from "@dataflow-guardian/shared";
import { findMatchingPolicy } from "../policy/policy.evaluator.js";
import { resolveHighestPrecedence } from "./decision.precedence.js";
import { redactContent } from "../redaction/redaction.service.js";

// Pure logic — no database calls here on purpose. This function is
// pure business rules; decision.repository.js (below) is the only
// file that persists anything.
export async function makeDecision({ content, detections, policies, riskScore }) {
  // Check EACH detection against the policies independently — one
  // piece of text might contain both a low-risk email (ALLOW) and a
  // credit card (BLOCK). Precedence resolves which one wins overall.
  const matches = detections.map((detection) => {
    const policy = findMatchingPolicy(policies, {
      DATA_TYPE: detection.type,
      SENSITIVITY: detection.sensitivity,
      RISK_SCORE: riskScore
    });
    return { detection, policy };
  });

  const actions = matches.map((m) => m.policy?.action ?? DECISION_ACTIONS.ALLOW);
  const finalAction = resolveHighestPrecedence(actions.length ? actions : [DECISION_ACTIONS.ALLOW]);

  // Set, not array — if 3 detections all matched the same policy,
  // we only want that policy's id once in the response.
  const matchedPolicyIds = [...new Set(matches.filter((m) => m.policy).map((m) => m.policy.id))];

  const sanitizedContent = finalAction === DECISION_ACTIONS.REDACT
    ? redactContent(content, detections)
    : null;

  return {
    action: finalAction,
    status: finalAction === DECISION_ACTIONS.REQUIRE_APPROVAL ? "PENDING" : "FINAL",
    riskScore,
    reason: buildReason(finalAction, matches),
    matchedPolicyIds,
    detections,
    sanitizedContent,
    approvalRequestId: null
  };
}

function buildReason(action, matches) {
  if (action === DECISION_ACTIONS.ALLOW) return "No policy violations detected.";
  const triggeringTypes = [...new Set(
    matches.filter((m) => m.policy?.action === action).map((m) => m.detection.type)
  )];
  return `${action} triggered by: ${triggeringTypes.join(", ")}`;
}
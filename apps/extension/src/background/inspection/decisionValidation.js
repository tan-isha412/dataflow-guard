import { DECISION_ACTIONS } from "../../shared/decisionActions.js";

const VALID_ACTIONS = new Set(Object.values(DECISION_ACTIONS));

/**
 * Guards the fail-closed property at the boundary where a backend
 * response turns into an enforcement decision: an unrecognized or
 * structurally broken decision must never be treated as ALLOW. This is
 * deliberately strict rather than "best effort" — a decision this
 * function rejects becomes a GUARDIAN_UNAVAILABLE-style outcome
 * upstream, never a silent pass-through.
 */
export function isValidDecision(decision) {
  if (!decision || typeof decision !== "object") return false;
  if (!VALID_ACTIONS.has(decision.action)) return false;
  if (decision.action === DECISION_ACTIONS.REDACT && typeof decision.sanitizedContent !== "string") {
    return false;
  }
  return true;
}

/**
 * Final actions that the security system can take.
 */
export const DECISION_ACTIONS = Object.freeze({
  ALLOW: "ALLOW",
  REDACT: "REDACT",
  BLOCK: "BLOCK",
  REQUIRE_APPROVAL: "REQUIRE_APPROVAL"
});

/**
 * Decision statuses.
 */
export const DECISION_STATUSES = Object.freeze({
  PENDING: "PENDING",
  FINAL: "FINAL",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  EXPIRED: "EXPIRED"
});

/**
 * @typedef {Object} Decision
 * @property {string} action
 * @property {string} status
 * @property {number} riskScore
 * @property {string} reason
 * @property {Array<string>} matchedPolicyIds
 * @property {Array<Object>} detections
 * @property {string|null} sanitizedContent
 * @property {string|null} approvalRequestId
 */

export function isValidDecisionAction(value) {
  return Object.values(DECISION_ACTIONS).includes(value);
}
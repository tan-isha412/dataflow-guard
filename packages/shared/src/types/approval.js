/**
 * Lifecycle states for an approval request created by a
 * REQUIRE_APPROVAL decision.
 */
export const APPROVAL_STATUSES = Object.freeze({
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  EXPIRED: "EXPIRED"
});

/**
 * @typedef {Object} ApprovalRequest
 * @property {string} id
 * @property {string} organizationId
 * @property {string} requestedByUserId
 * @property {string|null} decidedByUserId
 * @property {string} status
 * @property {string} reason
 * @property {Array<Object>} detections
 * @property {string} destinationId
 * @property {string} createdAt
 * @property {string|null} decidedAt
 * @property {string} expiresAt
 */

export function isValidApprovalStatus(value) {
  return Object.values(APPROVAL_STATUSES).includes(value);
}

export function isApprovalDecided(status) {
  return status === APPROVAL_STATUSES.APPROVED || status === APPROVAL_STATUSES.REJECTED;
}
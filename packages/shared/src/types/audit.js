/**
 * Every kind of event the system writes to the immutable audit log.
 */
export const AUDIT_EVENT_TYPES = Object.freeze({
  USER_LOGIN: "USER_LOGIN",
  USER_LOGOUT: "USER_LOGOUT",
  MEMBER_INVITED: "MEMBER_INVITED",
  ROLE_CHANGED: "ROLE_CHANGED",
  POLICY_CREATED: "POLICY_CREATED",
  POLICY_UPDATED: "POLICY_UPDATED",
  POLICY_DELETED: "POLICY_DELETED",
  DESTINATION_CREATED: "DESTINATION_CREATED",
  DESTINATION_STATUS_CHANGED: "DESTINATION_STATUS_CHANGED",
  INSPECTION_PERFORMED: "INSPECTION_PERFORMED",
  APPROVAL_REQUESTED: "APPROVAL_REQUESTED",
  APPROVAL_GRANTED: "APPROVAL_GRANTED",
  APPROVAL_REJECTED: "APPROVAL_REJECTED",
  APPROVAL_EXPIRED: "APPROVAL_EXPIRED"
});

/**
 * @typedef {Object} AuditEvent
 * @property {string} id
 * @property {string} organizationId
 * @property {string|null} actorUserId
 * @property {string} eventType
 * @property {Object} metadata
 * @property {string} createdAt
 */

export function isValidAuditEventType(value) {
  return Object.values(AUDIT_EVENT_TYPES).includes(value);
}
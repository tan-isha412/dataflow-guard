/**
 * Types of destinations that data can be sent to.
 */
export const DESTINATION_TYPES = Object.freeze({
  EXTERNAL_AI: "EXTERNAL_AI",
  INTERNAL_AI: "INTERNAL_AI",
  EXTERNAL_API: "EXTERNAL_API",
  INTERNAL_API: "INTERNAL_API",
  SAAS: "SAAS",
  DATABASE: "DATABASE",
  STORAGE: "STORAGE",
  WEBHOOK: "WEBHOOK",
  CUSTOM: "CUSTOM"
});

/**
 * Destination approval states.
 */
export const DESTINATION_STATUSES = Object.freeze({
  APPROVED: "APPROVED",
  UNAPPROVED: "UNAPPROVED",
  PENDING_REVIEW: "PENDING_REVIEW",
  BLOCKED: "BLOCKED"
});

/**
 * Risk levels associated with a destination.
 */
export const DESTINATION_RISK_LEVELS = Object.freeze({
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL"
});

/**
 * @typedef {Object} Destination
 * @property {string} id
 * @property {string} organizationId
 * @property {string} name
 * @property {string} type
 * @property {string} baseUrl
 * @property {string} status
 * @property {string} riskLevel
 * @property {Array<string>} allowedDataTypes
 */

export function isValidDestinationType(value) {
  return Object.values(DESTINATION_TYPES).includes(value);
}

export function isValidDestinationStatus(value) {
  return Object.values(DESTINATION_STATUSES).includes(value);
}

export function isValidDestinationRiskLevel(value) {
  return Object.values(DESTINATION_RISK_LEVELS).includes(value);
}
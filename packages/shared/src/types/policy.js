import {
  DATA_TYPES,
  SENSITIVITY_LEVELS
} from "./detection.js";

import {
  DECISION_ACTIONS
} from "./decision.js";

/**
 * Operators supported by policy conditions.
 */
export const POLICY_OPERATORS = Object.freeze({
  EQUALS: "EQUALS",
  NOT_EQUALS: "NOT_EQUALS",
  IN: "IN",
  NOT_IN: "NOT_IN",
  GREATER_THAN: "GREATER_THAN",
  LESS_THAN: "LESS_THAN",
  GREATER_THAN_OR_EQUAL: "GREATER_THAN_OR_EQUAL",
  LESS_THAN_OR_EQUAL: "LESS_THAN_OR_EQUAL",
  EXISTS: "EXISTS"
});

/**
 * Fields that a policy can evaluate.
 */
export const POLICY_FIELDS = Object.freeze({
  DATA_TYPE: "DATA_TYPE",
  SENSITIVITY: "SENSITIVITY",
  DESTINATION_ID: "DESTINATION_ID",
  DESTINATION_TYPE: "DESTINATION_TYPE",
  DESTINATION_RISK: "DESTINATION_RISK",
  USER_ROLE: "USER_ROLE",
  REQUEST_TYPE: "REQUEST_TYPE",
  RECORD_COUNT: "RECORD_COUNT",
  RISK_SCORE: "RISK_SCORE"
});

/**
 * @typedef {Object} PolicyCondition
 * @property {string} field
 * @property {string} operator
 * @property {*} value
 */

/**
 * @typedef {Object} Policy
 * @property {string} id
 * @property {string} organizationId
 * @property {string} name
 * @property {string} description
 * @property {number} priority
 * @property {boolean} enabled
 * @property {Array<PolicyCondition>} conditions
 * @property {string} action
 */

export function isValidPolicyAction(value) {
  return Object.values(DECISION_ACTIONS).includes(value);
}

export function isValidPolicyField(value) {
  return Object.values(POLICY_FIELDS).includes(value);
}

export function isValidPolicyOperator(value) {
  return Object.values(POLICY_OPERATORS).includes(value);
}

export { DATA_TYPES, SENSITIVITY_LEVELS };
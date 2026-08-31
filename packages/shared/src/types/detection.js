/**
 * Types of sensitive data that DataFlow Guardian can detect.
 */
export const DATA_TYPES = Object.freeze({
  EMAIL: "EMAIL",
  PHONE: "PHONE",
  CREDIT_CARD: "CREDIT_CARD",
  IP_ADDRESS: "IP_ADDRESS",

  PERSON_NAME: "PERSON_NAME",
  ORGANIZATION_NAME: "ORGANIZATION_NAME",
  LOCATION: "LOCATION",

  AWS_ACCESS_KEY: "AWS_ACCESS_KEY",
  AWS_SECRET_KEY: "AWS_SECRET_KEY",
  GITHUB_TOKEN: "GITHUB_TOKEN",
  API_KEY: "API_KEY",
  JWT: "JWT",
  DATABASE_CONNECTION_STRING: "DATABASE_CONNECTION_STRING",
  PASSWORD: "PASSWORD",
  SECRET: "SECRET",

  CUSTOM: "CUSTOM"
});

/**
 * Sensitivity levels used throughout the system.
 */
export const SENSITIVITY_LEVELS = Object.freeze({
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL"
});

/**
 * Methods used to detect sensitive data.
 */
export const DETECTION_METHODS = Object.freeze({
  PATTERN: "PATTERN",
  VALIDATOR: "VALIDATOR",
  NER: "NER",
  ML: "ML",
  LLM: "LLM",
  CUSTOM_RULE: "CUSTOM_RULE"
});

/**
 * @typedef {Object} Detection
 * @property {string} id
 * @property {string} type
 * @property {string} sensitivity
 * @property {number} start
 * @property {number} end
 * @property {number} confidence
 * @property {string} method
 * @property {string} ruleId
 */

export function isValidDataType(value) {
  return Object.values(DATA_TYPES).includes(value);
}

export function isValidSensitivity(value) {
  return Object.values(SENSITIVITY_LEVELS).includes(value);
}
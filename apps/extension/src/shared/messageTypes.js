/**
 * Message type constants for chrome.runtime message passing between the
 * popup, background service worker, and content scripts.
 *
 * content-script.js cannot import this module (declarative content scripts
 * run as classic, non-module scripts), so its literal string values are
 * duplicated there and must be kept in sync with this file.
 */
export const MESSAGE_TYPES = Object.freeze({
  GET_STATUS: "GET_STATUS",
  STATUS_RESPONSE: "STATUS_RESPONSE",
  CONTENT_SCRIPT_PING: "CONTENT_SCRIPT_PING",
  CONTENT_SCRIPT_PING_ACK: "CONTENT_SCRIPT_PING_ACK",
  AUTH_LOGIN: "AUTH_LOGIN",
  AUTH_LOGIN_RESULT: "AUTH_LOGIN_RESULT",
  AUTH_LOGOUT: "AUTH_LOGOUT",
  AUTH_LOGOUT_RESULT: "AUTH_LOGOUT_RESULT",
  AUTH_GET_SESSION: "AUTH_GET_SESSION",
  AUTH_SESSION_RESPONSE: "AUTH_SESSION_RESPONSE",
  PROMPT_SUBMISSION: "PROMPT_SUBMISSION",
  PROMPT_SUBMISSION_RESULT: "PROMPT_SUBMISSION_RESULT",
  ERROR: "ERROR"
});

/**
 * Outcomes a PROMPT_SUBMISSION_RESULT payload can carry in its
 * `outcome` field. "DECISION" means a real decision object (ALLOW/
 * REDACT/BLOCK/REQUIRE_APPROVAL) came back from the backend — every
 * other outcome means the backend was never reached or couldn't be
 * trusted, and the extension must fail closed (never submit).
 */
export const SUBMISSION_OUTCOMES = Object.freeze({
  DECISION: "DECISION",
  AUTH_REQUIRED: "AUTH_REQUIRED",
  UNAUTHORIZED: "UNAUTHORIZED",
  GUARDIAN_UNAVAILABLE: "GUARDIAN_UNAVAILABLE",
  MALFORMED_DECISION: "MALFORMED_DECISION",
  INVALID_REQUEST: "INVALID_REQUEST"
});

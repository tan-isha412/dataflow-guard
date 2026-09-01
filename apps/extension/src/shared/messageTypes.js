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
  ERROR: "ERROR"
});

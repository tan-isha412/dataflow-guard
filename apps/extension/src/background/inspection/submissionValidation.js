/**
 * Defensive validation for PROMPT_SUBMISSION messages. The content
 * script is our own code, not an untrusted caller, but this still
 * guards against a bug there sending a malformed payload — the
 * background never assumes a message's shape just because it came
 * through chrome.runtime.onMessage.
 */
export function validatePromptSubmission(payload) {
  if (!payload || typeof payload !== "object") {
    return { valid: false, reason: "payload must be an object" };
  }
  if (typeof payload.submissionId !== "string" || payload.submissionId.length === 0) {
    return { valid: false, reason: "submissionId is required" };
  }
  if (typeof payload.content !== "string" || payload.content.trim().length === 0) {
    return { valid: false, reason: "content must be a non-empty string" };
  }
  if (payload.destination !== null && payload.destination !== undefined) {
    if (typeof payload.destination !== "object" || typeof payload.destination.destinationId !== "string") {
      return { valid: false, reason: "destination.destinationId must be a string when destination is provided" };
    }
  }
  return { valid: true };
}

import { ApiError } from "../auth/apiClient.js";
import { SUBMISSION_OUTCOMES } from "../../shared/messageTypes.js";

/**
 * Maps an error thrown by apiClient.authenticatedRequest("/inspect", ...)
 * to a PROMPT_SUBMISSION_RESULT outcome. Every branch here is a
 * "something went wrong, do not submit" outcome — there is no code path
 * from a caught error to SUBMISSION_OUTCOMES.DECISION. That's the fail-
 * closed guarantee: an unrecognized error still ends up on the
 * GUARDIAN_UNAVAILABLE branch (the default), never silently ALLOW.
 */
export function mapErrorToOutcome(error) {
  if (!(error instanceof ApiError)) {
    return SUBMISSION_OUTCOMES.GUARDIAN_UNAVAILABLE;
  }

  switch (error.code) {
    case "UNAUTHENTICATED":
    case "INVALID_TOKEN":
    case "SESSION_EXPIRED":
      return SUBMISSION_OUTCOMES.AUTH_REQUIRED;
    case "FORBIDDEN":
      return SUBMISSION_OUTCOMES.UNAUTHORIZED;
    case "NETWORK_ERROR":
      return SUBMISSION_OUTCOMES.NETWORK_ERROR;
    case "TIMEOUT":
      return SUBMISSION_OUTCOMES.TIMEOUT;
    default:
      // A response DID come back (apiClient.js only throws NETWORK_ERROR/
      // TIMEOUT for transport-level failures), so error.status is a real
      // HTTP status here — 5xx is the server's own fault, anything else
      // unrecognized falls back to the generic unavailable state.
      return error.status >= 500 ? SUBMISSION_OUTCOMES.SERVER_ERROR : SUBMISSION_OUTCOMES.GUARDIAN_UNAVAILABLE;
  }
}

import { SUBMISSION_OUTCOMES, MESSAGE_TYPES } from "../../shared/messageTypes.js";
import { validatePromptSubmission } from "./submissionValidation.js";
import { isValidDecision } from "./decisionValidation.js";
import { mapErrorToOutcome } from "./errorMapping.js";
import * as authService from "../auth/authService.js";
import { authenticatedRequest } from "../auth/apiClient.js";

/**
 * Handles one PROMPT_SUBMISSION message end to end:
 *   validate shape -> check session -> POST /inspect -> validate decision
 * Every branch returns a PROMPT_SUBMISSION_RESULT; the content script
 * never has to guess what a missing/odd response means. Never logs
 * `content` — see the callers; only this function ever sees the raw
 * prompt text, and it goes straight into the request body, never into
 * console output.
 */
export async function handlePromptSubmission(payload) {
  const validation = validatePromptSubmission(payload);
  if (!validation.valid) {
    return result(payload?.submissionId ?? null, SUBMISSION_OUTCOMES.INVALID_REQUEST, { reason: validation.reason });
  }

  const session = await authService.getSession();
  if (!session.authenticated) {
    return result(payload.submissionId, SUBMISSION_OUTCOMES.AUTH_REQUIRED);
  }

  try {
    // Data minimization (Phase 6): only what the backend actually uses
    // for detection/policy/risk goes over the wire. `source`, the page
    // URL, and the adapter id that promptInterceptor.js attaches as
    // `applicationContext` are deliberately NOT forwarded here — the
    // backend derives who/organization from the auth token, not from
    // anything the content script claims, so they'd never be more than
    // unused telemetry sitting in a request body. destinationType/
    // displayName ARE forwarded: they're what lets the backend apply
    // destination-aware policy/risk (Phase 7) instead of only a bare id.
    const decision = await authenticatedRequest("/inspect", {
      method: "POST",
      body: {
        content: payload.content,
        destinationId: payload.destination?.destinationId,
        destinationType: payload.destination?.destinationType,
        displayName: payload.destination?.displayName
      }
    });

    if (!isValidDecision(decision)) {
      return result(payload.submissionId, SUBMISSION_OUTCOMES.MALFORMED_DECISION);
    }

    return result(payload.submissionId, SUBMISSION_OUTCOMES.DECISION, { decision });
  } catch (error) {
    return result(payload.submissionId, mapErrorToOutcome(error));
  }
}

function result(submissionId, outcome, extra = {}) {
  return { type: MESSAGE_TYPES.PROMPT_SUBMISSION_RESULT, payload: { submissionId, outcome, ...extra } };
}

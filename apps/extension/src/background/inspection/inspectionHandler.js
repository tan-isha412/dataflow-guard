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
    const decision = await authenticatedRequest("/inspect", {
      method: "POST",
      body: { content: payload.content, destinationId: payload.destination?.destinationId }
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

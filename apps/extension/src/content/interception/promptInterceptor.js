import { MESSAGE_TYPES, SUBMISSION_OUTCOMES } from "../../shared/messageTypes.js";
import { sendToBackground } from "../../shared/messaging.js";
import { createInterceptionUi } from "./ui.js";

/**
 * Wires an adapter's onSubmitAttempt hook to the inspection pipeline:
 *
 *   user submits -> adapter already prevented the default action
 *     -> extract normalized PromptSubmission -> PROMPT_SUBMISSION message
 *     -> show "inspecting" -> act on the outcome (never both: either the
 *        adapter re-submits an approved/redacted version, or nothing is
 *        ever sent to the site)
 *
 * `deps` lets tests inject fakes for everything that isn't pure
 * decision logic (messaging, UI, window/crypto) — the production caller
 * (content-script.js) uses the defaults, which are the real things.
 */
export function createPromptInterceptor(adapter, deps = {}) {
  const ui = deps.ui ?? createInterceptionUi();
  const sendMessage = deps.sendMessage ?? sendToBackground;
  const windowRef = deps.windowRef ?? window;
  const generateId = deps.generateId ?? (() => crypto.randomUUID());

  // Non-null while an inspection request is outstanding. Anything that
  // resolves for a DIFFERENT id than this is stale (superseded by a
  // reset — see stop()/navigation handling in content-script.js) and is
  // discarded rather than acted on.
  let activeSubmissionId = null;

  function buildSubmission(content) {
    const destination = adapter.getDestination();
    return {
      content,
      destination,
      provider: destination.provider,
      source: "browser_extension",
      timestamp: Date.now()
    };
  }

  async function handleAttempt(content) {
    if (activeSubmissionId) {
      // Already inspecting a previous attempt (double-click, Enter
      // immediately followed by a button click) — dedup by ignoring,
      // not by firing a second /inspect request.
      return;
    }

    const submissionId = generateId();
    activeSubmissionId = submissionId;
    ui.showInspecting();

    const submission = buildSubmission(content);
    let response;
    try {
      response = await sendMessage({
        type: MESSAGE_TYPES.PROMPT_SUBMISSION,
        payload: {
          submissionId,
          ...submission,
          applicationContext: { url: windowRef.location.href, adapterId: adapter.id }
        }
      });
    } catch (error) {
      console.error("[DataFlow Guardian] could not reach background service worker", error);
      if (activeSubmissionId === submissionId) {
        activeSubmissionId = null;
        ui.showUnavailable();
      }
      return;
    }

    if (activeSubmissionId !== submissionId) {
      return; // superseded — see reset()
    }
    activeSubmissionId = null;

    const result = response?.payload;
    if (response?.type !== MESSAGE_TYPES.PROMPT_SUBMISSION_RESULT || !result) {
      ui.showUnavailable();
      return;
    }

    handleOutcome(content, result);
  }

  function handleOutcome(originalContent, result) {
    switch (result.outcome) {
      case SUBMISSION_OUTCOMES.DECISION:
        return handleDecision(originalContent, result.decision);
      case SUBMISSION_OUTCOMES.AUTH_REQUIRED:
        return ui.showAuthRequired();
      case SUBMISSION_OUTCOMES.UNAUTHORIZED:
        return ui.showUnauthorized();
      case SUBMISSION_OUTCOMES.INVALID_REQUEST:
      case SUBMISSION_OUTCOMES.MALFORMED_DECISION:
      case SUBMISSION_OUTCOMES.GUARDIAN_UNAVAILABLE:
      default:
        return ui.showUnavailable();
    }
  }

  function handleDecision(originalContent, decision) {
    // Race guard: the user may have kept editing while the request was
    // in flight. Neither the original nor the sanitized version was
    // computed against what's in the box right now, so submit neither —
    // discard and let their next attempt get a fresh inspection.
    if (adapter.getCurrentPromptText() !== originalContent.trim()) {
      ui.showStale();
      return;
    }

    switch (decision.action) {
      case "ALLOW":
        ui.showAllowed();
        adapter.submitApproved(originalContent);
        return;
      case "REDACT":
        ui.showRedacted();
        adapter.submitApproved(decision.sanitizedContent);
        return;
      case "BLOCK":
        ui.showBlocked(decision);
        return;
      case "REQUIRE_APPROVAL":
        ui.showApprovalRequired(decision);
        return;
      default:
        // isValidDecision() on the background side should make this
        // unreachable, but fail closed here too rather than trust it.
        ui.showUnavailable();
    }
  }

  const unsubscribeAdapter = adapter.onSubmitAttempt(handleAttempt);

  return {
    stop() {
      activeSubmissionId = null; // any in-flight response becomes stale and is ignored
      ui.hide();
      unsubscribeAdapter();
    }
  };
}

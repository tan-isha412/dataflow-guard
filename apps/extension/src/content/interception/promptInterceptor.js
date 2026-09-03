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
const APPROVAL_POLL_INTERVAL_MS = 5000;
const APPROVAL_POLL_MAX_ATTEMPTS = 24; // ~2 minutes — a bounded check-in, not a real-time subscription

export function createPromptInterceptor(adapter, deps = {}) {
  const ui = deps.ui ?? createInterceptionUi();
  const sendMessage = deps.sendMessage ?? sendToBackground;
  const windowRef = deps.windowRef ?? window;
  const generateId = deps.generateId ?? (() => crypto.randomUUID());
  // Deliberately NOT windowRef.setInterval — windowRef here is only ever
  // a location-bearing stand-in (see buildSubmission), not a full window,
  // so timers use the platform global directly.
  const setIntervalFn = deps.setInterval ?? globalThis.setInterval.bind(globalThis);
  const clearIntervalFn = deps.clearInterval ?? globalThis.clearInterval.bind(globalThis);

  // Non-null while an inspection request is outstanding. Anything that
  // resolves for a DIFFERENT id than this is stale (superseded by a
  // reset — see stop()/navigation handling in content-script.js) and is
  // discarded rather than acted on.
  let activeSubmissionId = null;
  let approvalPollTimer = null;

  function stopApprovalPoll() {
    if (approvalPollTimer) {
      clearIntervalFn(approvalPollTimer);
      approvalPollTimer = null;
    }
  }

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

    // A fresh attempt supersedes any approval we were still waiting on
    // for a previous (now-irrelevant) prompt.
    stopApprovalPoll();

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
      // Each of these still results in NOTHING being submitted — same
      // fail-closed guarantee as the default case — they just get a
      // more specific message per Phase 5's "distinguish..." requirement.
      case SUBMISSION_OUTCOMES.NETWORK_ERROR:
        return ui.showNetworkError();
      case SUBMISSION_OUTCOMES.TIMEOUT:
        return ui.showTimeout();
      case SUBMISSION_OUTCOMES.SERVER_ERROR:
        return ui.showServerError();
      case SUBMISSION_OUTCOMES.MALFORMED_DECISION:
        return ui.showMalformedDecision();
      case SUBMISSION_OUTCOMES.INVALID_REQUEST:
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
        if (decision.approvalRequestId) {
          startApprovalPoll(decision.approvalRequestId);
        }
        return;
      default:
        // isValidDecision() on the background side should make this
        // unreachable, but fail closed here too rather than trust it.
        ui.showUnavailable();
    }
  }

  // Bounded polling against the EXISTING approvals API (GET /approvals/:id)
  // — not a new notification system, just reading the one that's already
  // there. Stops on: a decision, hitting the attempt cap, or being
  // superseded by stopApprovalPoll() (a new submission, or stop()).
  function startApprovalPoll(approvalRequestId) {
    stopApprovalPoll();
    let attempts = 0;

    approvalPollTimer = setIntervalFn(async () => {
      attempts += 1;
      if (attempts > APPROVAL_POLL_MAX_ATTEMPTS) {
        stopApprovalPoll();
        return;
      }

      let response;
      try {
        response = await sendMessage({
          type: MESSAGE_TYPES.CHECK_APPROVAL_STATUS,
          payload: { approvalRequestId }
        });
      } catch {
        return; // transient failure — try again on the next tick
      }

      const result = response?.payload;
      if (!result?.success || !result.found) {
        return;
      }

      if (result.status === "APPROVED") {
        stopApprovalPoll();
        ui.showApprovalApproved();
      } else if (result.status === "REJECTED") {
        stopApprovalPoll();
        ui.showApprovalRejected(result.approval);
      }
      // PENDING / EXPIRED-not-yet-processed: keep polling.
    }, APPROVAL_POLL_INTERVAL_MS);
  }

  const unsubscribeAdapter = adapter.onSubmitAttempt(handleAttempt);

  return {
    stop() {
      activeSubmissionId = null; // any in-flight response becomes stale and is ignored
      stopApprovalPoll();
      ui.hide();
      unsubscribeAdapter();
    }
  };
}

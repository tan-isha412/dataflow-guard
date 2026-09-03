/**
 * A small, non-intrusive panel shown in the corner of the page while
 * DataFlow Guardian is inspecting or has just acted on a submission.
 * Rendered inside a shadow root so the host page's CSS can't distort it
 * (and vice versa — nothing here can leak into ChatGPT's own styles).
 *
 * Factory-based (like chatgptAdapter.js/pageLifecycle.js) so tests can
 * inject a fake/happy-dom document instead of requiring a real browser.
 */
export function createInterceptionUi(documentRef = globalThis.document) {
  let host = null;
  let shadow = null;
  let autoHideTimer = null;

  function ensureHost() {
    if (host) return shadow;
    host = documentRef.createElement("div");
    host.id = "dataflow-guardian-panel-host";
    host.style.all = "initial";
    host.style.position = "fixed";
    host.style.bottom = "16px";
    host.style.right = "16px";
    host.style.zIndex = "2147483647";
    documentRef.body.appendChild(host);
    shadow = host.attachShadow({ mode: "open" });
    return shadow;
  }

  function render({ title, body, kind, dismissible = true, autoHideMs = null }) {
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
      autoHideTimer = null;
    }

    const root = ensureHost();
    root.innerHTML = "";

    const style = documentRef.createElement("style");
    style.textContent = `
      .panel {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        width: 280px;
        border-radius: 8px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
        padding: 12px 14px;
        color: #1a1a1a;
        background: #ffffff;
        border-left: 4px solid var(--accent, #6b7280);
      }
      .title { font-size: 13px; font-weight: 600; margin: 0 0 4px; display: flex; justify-content: space-between; gap: 8px; }
      .body { font-size: 12px; color: #374151; margin: 0; white-space: pre-line; }
      .close { cursor: pointer; border: none; background: none; font-size: 13px; color: #9ca3af; padding: 0; line-height: 1; }
    `;

    const panel = documentRef.createElement("div");
    panel.className = "panel";
    panel.style.setProperty("--accent", accentFor(kind));

    const titleEl = documentRef.createElement("p");
    titleEl.className = "title";
    const titleText = documentRef.createElement("span");
    titleText.textContent = title;
    titleEl.appendChild(titleText);

    if (dismissible) {
      const closeBtn = documentRef.createElement("button");
      closeBtn.className = "close";
      closeBtn.type = "button";
      closeBtn.textContent = "✕";
      closeBtn.setAttribute("aria-label", "Dismiss");
      closeBtn.addEventListener("click", hide);
      titleEl.appendChild(closeBtn);
    }

    const bodyEl = documentRef.createElement("p");
    bodyEl.className = "body";
    bodyEl.textContent = body;

    panel.append(titleEl, bodyEl);
    root.append(style, panel);

    if (autoHideMs) {
      autoHideTimer = setTimeout(hide, autoHideMs);
    }
  }

  function accentFor(kind) {
    switch (kind) {
      case "allow": return "#15803d";
      case "redact": return "#b45309";
      case "block": return "#b91c1c";
      case "approval": return "#7c3aed";
      case "error": return "#b91c1c";
      default: return "#2563eb"; // inspecting / neutral
    }
  }

  function hide() {
    if (host) {
      host.remove();
      host = null;
      shadow = null;
    }
    if (autoHideTimer) {
      clearTimeout(autoHideTimer);
      autoHideTimer = null;
    }
  }

  return {
    hide,

    showInspecting: () =>
      render({ kind: "inspecting", title: "DataFlow Guardian", body: "Checking with DataFlow Guardian…", dismissible: false }),

    showAllowed: () =>
      render({ kind: "allow", title: "Allowed", body: "No policy violations detected.", autoHideMs: 2000 }),

    showRedacted: () =>
      render({
        kind: "redact",
        title: "Sensitive data redacted",
        body: "Some content was removed before sending, based on your organization's policy.",
        autoHideMs: 4000
      }),

    showBlocked: (decision) =>
      render({
        kind: "block",
        title: "Request blocked",
        body: formatBlockedBody(decision)
      }),

    showApprovalRequired: (decision) =>
      render({
        kind: "approval",
        title: "Approval required",
        body: formatApprovalBody(decision)
      }),

    showAuthRequired: () =>
      render({
        kind: "error",
        title: "Sign in required",
        body: "Open the DataFlow Guardian extension and sign in to continue using AI sites safely."
      }),

    showUnauthorized: () =>
      render({
        kind: "error",
        title: "Not permitted",
        body: "Your account doesn't have permission to use DataFlow Guardian inspection. Contact your organization admin."
      }),

    showUnavailable: () =>
      render({
        kind: "error",
        title: "DataFlow Guardian unavailable",
        body: "Could not reach DataFlow Guardian, so your prompt was not sent. Please try again."
      }),

    showNetworkError: () =>
      render({
        kind: "error",
        title: "Connection problem",
        body: "Couldn't connect to DataFlow Guardian. Check your network and try again — your prompt was not sent."
      }),

    showTimeout: () =>
      render({
        kind: "error",
        title: "Taking too long",
        body: "DataFlow Guardian didn't respond in time, so your prompt was not sent. Please try again."
      }),

    showServerError: () =>
      render({
        kind: "error",
        title: "DataFlow Guardian error",
        body: "DataFlow Guardian hit an unexpected error, so your prompt was not sent. If this keeps happening, contact your organization admin."
      }),

    showMalformedDecision: () =>
      render({
        kind: "error",
        title: "Unexpected response",
        body: "DataFlow Guardian returned a response we couldn't understand, so your prompt was not sent. Please try again."
      }),

    showApprovalPending: () =>
      render({
        kind: "approval",
        title: "Waiting for approval",
        body: "Still waiting on your organization to review this request."
      }),

    // Deliberately does not auto-resubmit: the request was approved
    // against a specific piece of content, and by the time approval
    // comes back the user may have edited it, navigated away, or closed
    // the tab. Re-checking on a fresh submit attempt is safer than
    // silently sending something that was never re-verified.
    showApprovalApproved: () =>
      render({
        kind: "allow",
        title: "Approved",
        body: "Your organization approved this request. Submit it again to send it.",
        autoHideMs: 8000
      }),

    showApprovalRejected: (decision) =>
      render({
        kind: "block",
        title: "Approval rejected",
        body: formatApprovalRejectedBody(decision)
      }),

    showStale: () =>
      render({
        kind: "error",
        title: "Prompt changed",
        body: "Your prompt changed while it was being checked. Please submit again.",
        autoHideMs: 4000
      })
  };
}

function formatBlockedBody(decision) {
  const types = [...new Set((decision?.detections ?? []).map((d) => d.type))];
  const lines = ["This content was not sent."];
  if (types.length) lines.push(`Detected: ${types.join(", ")}`);
  if (typeof decision?.riskScore === "number") lines.push(`Risk score: ${decision.riskScore}`);
  if (decision?.reason) lines.push(decision.reason);
  return lines.join("\n");
}

function formatApprovalBody(decision) {
  const lines = ["This request needs approval before it can be sent."];
  if (decision?.reason) lines.push(decision.reason);
  if (decision?.approvalRequestId) lines.push(`Reference: ${decision.approvalRequestId}`);
  return lines.join("\n");
}

function formatApprovalRejectedBody(decision) {
  const lines = ["This content was not sent."];
  if (decision?.reason) lines.push(decision.reason);
  return lines.join("\n");
}

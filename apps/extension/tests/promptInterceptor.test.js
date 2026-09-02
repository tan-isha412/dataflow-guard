import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPromptInterceptor } from "../src/content/interception/promptInterceptor.js";
import { MESSAGE_TYPES, SUBMISSION_OUTCOMES } from "../src/shared/messageTypes.js";

function createFakeAdapter({ currentText = "explain recursion" } = {}) {
  let submitCallback = null;
  return {
    id: "chatgpt",
    getDestination: () => ({ destinationId: "chatgpt", provider: "OpenAI", destinationType: "EXTERNAL_AI", displayName: "ChatGPT" }),
    getCurrentPromptText: vi.fn(() => currentText),
    setCurrentText: (text) => {
      currentText = text;
    },
    onSubmitAttempt: vi.fn((cb) => {
      submitCallback = cb;
      return () => {
        submitCallback = null;
      };
    }),
    submitApproved: vi.fn(() => true),
    // test helper, not part of the real adapter contract
    _triggerSubmit(content) {
      submitCallback?.(content);
    }
  };
}

function createFakeUi() {
  return {
    hide: vi.fn(),
    showInspecting: vi.fn(),
    showAllowed: vi.fn(),
    showRedacted: vi.fn(),
    showBlocked: vi.fn(),
    showApprovalRequired: vi.fn(),
    showAuthRequired: vi.fn(),
    showUnauthorized: vi.fn(),
    showUnavailable: vi.fn(),
    showStale: vi.fn()
  };
}

function decisionResult(submissionId, decision) {
  return { type: MESSAGE_TYPES.PROMPT_SUBMISSION_RESULT, payload: { submissionId, outcome: SUBMISSION_OUTCOMES.DECISION, decision } };
}

function outcomeResult(submissionId, outcome) {
  return { type: MESSAGE_TYPES.PROMPT_SUBMISSION_RESULT, payload: { submissionId, outcome } };
}

// Resolves sendMessage with whatever the test wants, but lets us
// control WHEN it resolves (deferred), for race-condition tests.
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("createPromptInterceptor — SAFE PROMPT -> ALLOW", () => {
  it("submits the original content and shows the allowed state", async () => {
    const adapter = createFakeAdapter({ currentText: "Explain recursion in JavaScript." });
    const ui = createFakeUi();
    const sendMessage = vi.fn();
    const d = deferred();
    sendMessage.mockReturnValue(d.promise);

    createPromptInterceptor(adapter, { ui, sendMessage, windowRef: { location: { href: "https://chatgpt.com/" } } });
    adapter._triggerSubmit("Explain recursion in JavaScript.");

    expect(ui.showInspecting).toHaveBeenCalledTimes(1);
    const sentMessage = sendMessage.mock.calls[0][0];
    expect(sentMessage.type).toBe(MESSAGE_TYPES.PROMPT_SUBMISSION);
    expect(sentMessage.payload.content).toBe("Explain recursion in JavaScript.");
    expect(sentMessage.payload.destination.destinationId).toBe("chatgpt");

    d.resolve(decisionResult(sentMessage.payload.submissionId, { action: "ALLOW", riskScore: 0, detections: [] }));
    await flushMicrotasks();

    expect(ui.showAllowed).toHaveBeenCalledTimes(1);
    expect(adapter.submitApproved).toHaveBeenCalledWith("Explain recursion in JavaScript.");
  });
});

describe("createPromptInterceptor — SENSITIVE DATA -> BLOCK", () => {
  it("does NOT submit and shows the blocked state with decision details", async () => {
    const adapter = createFakeAdapter({ currentText: "my card is 4532015112830366" });
    const ui = createFakeUi();
    const sendMessage = vi.fn();
    const d = deferred();
    sendMessage.mockReturnValue(d.promise);

    createPromptInterceptor(adapter, { ui, sendMessage, windowRef: { location: { href: "https://chatgpt.com/" } } });
    adapter._triggerSubmit("my card is 4532015112830366");

    const submissionId = sendMessage.mock.calls[0][0].payload.submissionId;
    const decision = { action: "BLOCK", riskScore: 90, detections: [{ type: "CREDIT_CARD" }], reason: "BLOCK triggered by: CREDIT_CARD" };
    d.resolve(decisionResult(submissionId, decision));
    await flushMicrotasks();

    expect(ui.showBlocked).toHaveBeenCalledWith(decision);
    expect(adapter.submitApproved).not.toHaveBeenCalled();
  });
});

describe("createPromptInterceptor — REDACTION", () => {
  it("submits the SANITIZED content, never the original", async () => {
    const adapter = createFakeAdapter({ currentText: "my customer's email is john@example.com" });
    const ui = createFakeUi();
    const sendMessage = vi.fn();
    const d = deferred();
    sendMessage.mockReturnValue(d.promise);

    createPromptInterceptor(adapter, { ui, sendMessage, windowRef: { location: { href: "https://chatgpt.com/" } } });
    adapter._triggerSubmit("my customer's email is john@example.com");

    const submissionId = sendMessage.mock.calls[0][0].payload.submissionId;
    const decision = { action: "REDACT", sanitizedContent: "my customer's email is [REDACTED]", detections: [{ type: "EMAIL" }] };
    d.resolve(decisionResult(submissionId, decision));
    await flushMicrotasks();

    expect(ui.showRedacted).toHaveBeenCalledTimes(1);
    expect(adapter.submitApproved).toHaveBeenCalledWith("my customer's email is [REDACTED]");
    expect(adapter.submitApproved).not.toHaveBeenCalledWith(expect.stringContaining("john@example.com"));
  });
});

describe("createPromptInterceptor — REQUIRE_APPROVAL", () => {
  it("does NOT submit and shows the pending-approval state", async () => {
    const adapter = createFakeAdapter({ currentText: "share our unreleased roadmap externally" });
    const ui = createFakeUi();
    const sendMessage = vi.fn();
    const d = deferred();
    sendMessage.mockReturnValue(d.promise);

    createPromptInterceptor(adapter, { ui, sendMessage, windowRef: { location: { href: "https://chatgpt.com/" } } });
    adapter._triggerSubmit("share our unreleased roadmap externally");

    const submissionId = sendMessage.mock.calls[0][0].payload.submissionId;
    const decision = { action: "REQUIRE_APPROVAL", approvalRequestId: "appr-1", reason: "needs approval" };
    d.resolve(decisionResult(submissionId, decision));
    await flushMicrotasks();

    expect(ui.showApprovalRequired).toHaveBeenCalledWith(decision);
    expect(adapter.submitApproved).not.toHaveBeenCalled();
  });
});

describe("createPromptInterceptor — duplicate submission prevention", () => {
  it("ignores a second attempt while the first is still being inspected", async () => {
    const adapter = createFakeAdapter({ currentText: "hello" });
    const ui = createFakeUi();
    const sendMessage = vi.fn();
    const d = deferred();
    sendMessage.mockReturnValue(d.promise);

    createPromptInterceptor(adapter, { ui, sendMessage, windowRef: { location: { href: "https://chatgpt.com/" } } });
    adapter._triggerSubmit("hello");
    adapter._triggerSubmit("hello"); // rapid double-click / Enter-then-click
    adapter._triggerSubmit("hello");

    expect(sendMessage).toHaveBeenCalledTimes(1);

    const submissionId = sendMessage.mock.calls[0][0].payload.submissionId;
    d.resolve(decisionResult(submissionId, { action: "ALLOW" }));
    await flushMicrotasks();

    // once resolved, a fresh attempt is allowed again
    const d2 = deferred();
    sendMessage.mockReturnValue(d2.promise);
    adapter._triggerSubmit("hello");
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });
});

describe("createPromptInterceptor — race: prompt changes during inspection", () => {
  it("does not submit either version if the box no longer matches what was inspected", async () => {
    const adapter = createFakeAdapter({ currentText: "original text" });
    const ui = createFakeUi();
    const sendMessage = vi.fn();
    const d = deferred();
    sendMessage.mockReturnValue(d.promise);

    createPromptInterceptor(adapter, { ui, sendMessage, windowRef: { location: { href: "https://chatgpt.com/" } } });
    adapter._triggerSubmit("original text");

    // user keeps typing while the request is in flight
    adapter.setCurrentText("original text, but now edited");

    const submissionId = sendMessage.mock.calls[0][0].payload.submissionId;
    d.resolve(decisionResult(submissionId, { action: "ALLOW" }));
    await flushMicrotasks();

    expect(ui.showStale).toHaveBeenCalledTimes(1);
    expect(adapter.submitApproved).not.toHaveBeenCalled();
  });
});

describe("createPromptInterceptor — auth / availability failures fail closed", () => {
  it("AUTH_REQUIRED outcome: shows sign-in state, never submits", async () => {
    const adapter = createFakeAdapter();
    const ui = createFakeUi();
    const sendMessage = vi.fn();
    const d = deferred();
    sendMessage.mockReturnValue(d.promise);
    createPromptInterceptor(adapter, { ui, sendMessage, windowRef: { location: { href: "https://chatgpt.com/" } } });

    adapter._triggerSubmit("hello");
    const submissionId = sendMessage.mock.calls[0][0].payload.submissionId;
    d.resolve(outcomeResult(submissionId, SUBMISSION_OUTCOMES.AUTH_REQUIRED));
    await flushMicrotasks();

    expect(ui.showAuthRequired).toHaveBeenCalledTimes(1);
    expect(adapter.submitApproved).not.toHaveBeenCalled();
  });

  it("a rejected sendMessage (service worker unreachable) shows the unavailable state", async () => {
    const adapter = createFakeAdapter();
    const ui = createFakeUi();
    const sendMessage = vi.fn().mockRejectedValue(new Error("Extension context invalidated"));
    createPromptInterceptor(adapter, { ui, sendMessage, windowRef: { location: { href: "https://chatgpt.com/" } } });

    adapter._triggerSubmit("hello");
    await flushMicrotasks();

    expect(ui.showUnavailable).toHaveBeenCalledTimes(1);
    expect(adapter.submitApproved).not.toHaveBeenCalled();
  });

  it("GUARDIAN_UNAVAILABLE outcome (backend down/timeout) fails closed", async () => {
    const adapter = createFakeAdapter();
    const ui = createFakeUi();
    const sendMessage = vi.fn();
    const d = deferred();
    sendMessage.mockReturnValue(d.promise);
    createPromptInterceptor(adapter, { ui, sendMessage, windowRef: { location: { href: "https://chatgpt.com/" } } });

    adapter._triggerSubmit("hello");
    const submissionId = sendMessage.mock.calls[0][0].payload.submissionId;
    d.resolve(outcomeResult(submissionId, SUBMISSION_OUTCOMES.GUARDIAN_UNAVAILABLE));
    await flushMicrotasks();

    expect(ui.showUnavailable).toHaveBeenCalledTimes(1);
    expect(adapter.submitApproved).not.toHaveBeenCalled();
  });

  it("an unrecognized outcome string also fails closed (never treated as allow)", async () => {
    const adapter = createFakeAdapter();
    const ui = createFakeUi();
    const sendMessage = vi.fn();
    const d = deferred();
    sendMessage.mockReturnValue(d.promise);
    createPromptInterceptor(adapter, { ui, sendMessage, windowRef: { location: { href: "https://chatgpt.com/" } } });

    adapter._triggerSubmit("hello");
    const submissionId = sendMessage.mock.calls[0][0].payload.submissionId;
    d.resolve(outcomeResult(submissionId, "SOMETHING_WE_DONT_KNOW"));
    await flushMicrotasks();

    expect(adapter.submitApproved).not.toHaveBeenCalled();
    expect(ui.showUnavailable).toHaveBeenCalledTimes(1);
  });
});

describe("createPromptInterceptor — stop() / navigation cancellation", () => {
  it("a response that arrives after stop() is discarded, not acted on", async () => {
    const adapter = createFakeAdapter({ currentText: "hello" });
    const ui = createFakeUi();
    const sendMessage = vi.fn();
    const d = deferred();
    sendMessage.mockReturnValue(d.promise);

    const interceptor = createPromptInterceptor(adapter, { ui, sendMessage, windowRef: { location: { href: "https://chatgpt.com/" } } });
    adapter._triggerSubmit("hello");
    const submissionId = sendMessage.mock.calls[0][0].payload.submissionId;

    interceptor.stop();
    d.resolve(decisionResult(submissionId, { action: "ALLOW" }));
    await flushMicrotasks();

    expect(adapter.submitApproved).not.toHaveBeenCalled();
  });
});

function flushMicrotasks() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

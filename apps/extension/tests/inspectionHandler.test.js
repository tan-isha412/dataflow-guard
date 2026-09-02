import { describe, it, expect, vi, beforeEach } from "vitest";

const { authenticatedRequest, getSession, ApiError } = vi.hoisted(() => {
  class ApiError extends Error {
    constructor(message, status, code) {
      super(message);
      this.status = status;
      this.code = code;
    }
  }
  return { authenticatedRequest: vi.fn(), getSession: vi.fn(), ApiError };
});

vi.mock("../src/background/auth/apiClient.js", () => ({ authenticatedRequest, ApiError }));
vi.mock("../src/background/auth/authService.js", () => ({ getSession }));

const { handlePromptSubmission } = await import("../src/background/inspection/inspectionHandler.js");
const { MESSAGE_TYPES, SUBMISSION_OUTCOMES } = await import("../src/shared/messageTypes.js");

const AUTHENTICATED_SESSION = { authenticated: true, user: { id: "u1" }, organization: { id: "o1" }, role: "ADMIN" };

beforeEach(() => {
  authenticatedRequest.mockReset();
  getSession.mockReset();
});

describe("handlePromptSubmission", () => {
  it("returns INVALID_REQUEST for a malformed payload without calling the backend", async () => {
    const response = await handlePromptSubmission({ content: "" });
    expect(response.type).toBe(MESSAGE_TYPES.PROMPT_SUBMISSION_RESULT);
    expect(response.payload.outcome).toBe(SUBMISSION_OUTCOMES.INVALID_REQUEST);
    expect(authenticatedRequest).not.toHaveBeenCalled();
  });

  it("returns AUTH_REQUIRED when there is no session, without calling /inspect", async () => {
    getSession.mockResolvedValue({ authenticated: false });
    const response = await handlePromptSubmission({ submissionId: "s1", content: "hello" });
    expect(response.payload.outcome).toBe(SUBMISSION_OUTCOMES.AUTH_REQUIRED);
    expect(authenticatedRequest).not.toHaveBeenCalled();
  });

  it("returns a DECISION outcome carrying the backend's decision on success", async () => {
    getSession.mockResolvedValue(AUTHENTICATED_SESSION);
    const decision = { action: "ALLOW", riskScore: 0, detections: [], sanitizedContent: null };
    authenticatedRequest.mockResolvedValue(decision);

    const response = await handlePromptSubmission({
      submissionId: "s1",
      content: "explain recursion",
      destination: { destinationId: "chatgpt" }
    });

    expect(response.payload.outcome).toBe(SUBMISSION_OUTCOMES.DECISION);
    expect(response.payload.decision).toEqual(decision);
    expect(response.payload.submissionId).toBe("s1");
    expect(authenticatedRequest).toHaveBeenCalledWith(
      "/inspect",
      expect.objectContaining({ method: "POST", body: { content: "explain recursion", destinationId: "chatgpt" } })
    );
  });

  it("returns MALFORMED_DECISION when the backend responds 200 with something that isn't a real decision", async () => {
    getSession.mockResolvedValue(AUTHENTICATED_SESSION);
    authenticatedRequest.mockResolvedValue({ oops: "not a decision" });

    const response = await handlePromptSubmission({ submissionId: "s1", content: "hi" });
    expect(response.payload.outcome).toBe(SUBMISSION_OUTCOMES.MALFORMED_DECISION);
  });

  it("returns GUARDIAN_UNAVAILABLE on a network error, never a DECISION", async () => {
    getSession.mockResolvedValue(AUTHENTICATED_SESSION);
    authenticatedRequest.mockRejectedValue(new ApiError("down", 0, "NETWORK_ERROR"));

    const response = await handlePromptSubmission({ submissionId: "s1", content: "hi" });
    expect(response.payload.outcome).toBe(SUBMISSION_OUTCOMES.GUARDIAN_UNAVAILABLE);
  });

  it("returns AUTH_REQUIRED when the access token is expired and refresh also fails", async () => {
    getSession.mockResolvedValue(AUTHENTICATED_SESSION);
    authenticatedRequest.mockRejectedValue(new ApiError("expired", 401, "SESSION_EXPIRED"));

    const response = await handlePromptSubmission({ submissionId: "s1", content: "hi" });
    expect(response.payload.outcome).toBe(SUBMISSION_OUTCOMES.AUTH_REQUIRED);
  });

  it("returns UNAUTHORIZED when the org lacks permission (403)", async () => {
    getSession.mockResolvedValue(AUTHENTICATED_SESSION);
    authenticatedRequest.mockRejectedValue(new ApiError("nope", 403, "FORBIDDEN"));

    const response = await handlePromptSubmission({ submissionId: "s1", content: "hi" });
    expect(response.payload.outcome).toBe(SUBMISSION_OUTCOMES.UNAUTHORIZED);
  });

  it("never logs the prompt content (console.log is never called by this handler)", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    getSession.mockResolvedValue(AUTHENTICATED_SESSION);
    authenticatedRequest.mockResolvedValue({ action: "ALLOW" });

    await handlePromptSubmission({ submissionId: "s1", content: "super secret api_key=abc123" });

    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });
});

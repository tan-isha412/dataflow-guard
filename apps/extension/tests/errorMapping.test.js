import { describe, it, expect } from "vitest";
import { ApiError } from "../src/background/auth/apiClient.js";
import { mapErrorToOutcome } from "../src/background/inspection/errorMapping.js";
import { SUBMISSION_OUTCOMES } from "../src/shared/messageTypes.js";

describe("mapErrorToOutcome (fail-closed error mapping)", () => {
  it("maps NETWORK_ERROR to GUARDIAN_UNAVAILABLE", () => {
    expect(mapErrorToOutcome(new ApiError("x", 0, "NETWORK_ERROR"))).toBe(SUBMISSION_OUTCOMES.GUARDIAN_UNAVAILABLE);
  });

  it("maps TIMEOUT to GUARDIAN_UNAVAILABLE", () => {
    expect(mapErrorToOutcome(new ApiError("x", 0, "TIMEOUT"))).toBe(SUBMISSION_OUTCOMES.GUARDIAN_UNAVAILABLE);
  });

  it("maps a 500 server error to GUARDIAN_UNAVAILABLE", () => {
    expect(mapErrorToOutcome(new ApiError("x", 500, "INTERNAL_ERROR"))).toBe(SUBMISSION_OUTCOMES.GUARDIAN_UNAVAILABLE);
  });

  it("maps expired/invalid session errors to AUTH_REQUIRED", () => {
    expect(mapErrorToOutcome(new ApiError("x", 401, "SESSION_EXPIRED"))).toBe(SUBMISSION_OUTCOMES.AUTH_REQUIRED);
    expect(mapErrorToOutcome(new ApiError("x", 401, "UNAUTHENTICATED"))).toBe(SUBMISSION_OUTCOMES.AUTH_REQUIRED);
    expect(mapErrorToOutcome(new ApiError("x", 401, "INVALID_TOKEN"))).toBe(SUBMISSION_OUTCOMES.AUTH_REQUIRED);
  });

  it("maps FORBIDDEN (authenticated, lacks permission) to UNAUTHORIZED", () => {
    expect(mapErrorToOutcome(new ApiError("x", 403, "FORBIDDEN"))).toBe(SUBMISSION_OUTCOMES.UNAUTHORIZED);
  });

  it("maps an unrecognized error code to GUARDIAN_UNAVAILABLE rather than guessing ALLOW", () => {
    expect(mapErrorToOutcome(new ApiError("x", 418, "SOMETHING_NEW"))).toBe(SUBMISSION_OUTCOMES.GUARDIAN_UNAVAILABLE);
  });

  it("maps a non-ApiError (unexpected exception) to GUARDIAN_UNAVAILABLE", () => {
    expect(mapErrorToOutcome(new TypeError("boom"))).toBe(SUBMISSION_OUTCOMES.GUARDIAN_UNAVAILABLE);
  });
});

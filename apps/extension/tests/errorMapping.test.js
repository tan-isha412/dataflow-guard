import { describe, it, expect } from "vitest";
import { ApiError } from "../src/background/auth/apiClient.js";
import { mapErrorToOutcome } from "../src/background/inspection/errorMapping.js";
import { SUBMISSION_OUTCOMES } from "../src/shared/messageTypes.js";

describe("mapErrorToOutcome (fail-closed error mapping)", () => {
  it("maps NETWORK_ERROR to its own distinct outcome (still never ALLOW)", () => {
    expect(mapErrorToOutcome(new ApiError("x", 0, "NETWORK_ERROR"))).toBe(SUBMISSION_OUTCOMES.NETWORK_ERROR);
  });

  it("maps TIMEOUT to its own distinct outcome", () => {
    expect(mapErrorToOutcome(new ApiError("x", 0, "TIMEOUT"))).toBe(SUBMISSION_OUTCOMES.TIMEOUT);
  });

  it("maps a 500 server error to SERVER_ERROR", () => {
    expect(mapErrorToOutcome(new ApiError("x", 500, "INTERNAL_ERROR"))).toBe(SUBMISSION_OUTCOMES.SERVER_ERROR);
  });

  it("maps a 503 to SERVER_ERROR too (any 5xx)", () => {
    expect(mapErrorToOutcome(new ApiError("x", 503, "SERVICE_UNAVAILABLE"))).toBe(SUBMISSION_OUTCOMES.SERVER_ERROR);
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

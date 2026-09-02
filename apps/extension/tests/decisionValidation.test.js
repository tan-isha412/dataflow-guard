import { describe, it, expect } from "vitest";
import { DECISION_ACTIONS as REAL_DECISION_ACTIONS } from "@dataflow-guardian/shared/decision";
import { DECISION_ACTIONS } from "../src/shared/decisionActions.js";
import { isValidDecision } from "../src/background/inspection/decisionValidation.js";

describe("decisionActions mirrors the real shared package", () => {
  it("matches @dataflow-guardian/shared's DECISION_ACTIONS", () => {
    expect(DECISION_ACTIONS).toEqual(REAL_DECISION_ACTIONS);
  });
});

describe("isValidDecision (fail-closed guard)", () => {
  it("accepts a well-formed ALLOW decision", () => {
    expect(isValidDecision({ action: "ALLOW", riskScore: 0, detections: [] })).toBe(true);
  });

  it("accepts a well-formed BLOCK decision", () => {
    expect(isValidDecision({ action: "BLOCK", riskScore: 90, detections: [{ type: "CREDIT_CARD" }] })).toBe(true);
  });

  it("accepts a well-formed REQUIRE_APPROVAL decision", () => {
    expect(isValidDecision({ action: "REQUIRE_APPROVAL", approvalRequestId: "abc" })).toBe(true);
  });

  it("accepts a REDACT decision with sanitizedContent", () => {
    expect(isValidDecision({ action: "REDACT", sanitizedContent: "hi [EMAIL_REDACTED]" })).toBe(true);
  });

  it("rejects a REDACT decision missing sanitizedContent", () => {
    expect(isValidDecision({ action: "REDACT" })).toBe(false);
  });

  it("rejects an unrecognized action", () => {
    expect(isValidDecision({ action: "MAYBE_ALLOW" })).toBe(false);
  });

  it("rejects null/undefined", () => {
    expect(isValidDecision(null)).toBe(false);
    expect(isValidDecision(undefined)).toBe(false);
  });

  it("rejects a non-object", () => {
    expect(isValidDecision("ALLOW")).toBe(false);
  });

  it("rejects an object with no action field", () => {
    expect(isValidDecision({ riskScore: 0 })).toBe(false);
  });
});

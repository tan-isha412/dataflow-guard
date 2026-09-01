import { describe, it, expect } from "vitest";
import { makeDecision } from "../../src/modules/decision/decision.service.js";

describe("makeDecision", () => {
  it("returns ALLOW when there are no detections", async () => {
    const result = await makeDecision({ content: "hello", detections: [], policies: [], riskScore: 0 });
    expect(result.action).toBe("ALLOW");
    expect(result.sanitizedContent).toBeNull();
  });

  it("returns BLOCK when a matching policy says BLOCK", async () => {
    const policies = [{
      id: "p1", priority: 10, action: "BLOCK",
      conditions: [{ field: "DATA_TYPE", operator: "EQUALS", value: "CREDIT_CARD" }]
    }];
    const detections = [{ type: "CREDIT_CARD", sensitivity: "CRITICAL", start: 0, end: 16 }];

    const result = await makeDecision({ content: "4532015112830366", detections, policies, riskScore: 50 });

    expect(result.action).toBe("BLOCK");
    expect(result.matchedPolicyIds).toContain("p1");
    expect(result.sanitizedContent).toBeNull(); // BLOCK never redacts — it stops the request entirely
  });

  it("redacts content when the matching policy says REDACT", async () => {
    const policies = [{
      id: "p2", priority: 5, action: "REDACT",
      conditions: [{ field: "DATA_TYPE", operator: "EQUALS", value: "EMAIL" }]
    }];
    const detections = [{ type: "EMAIL", sensitivity: "MEDIUM", start: 7, end: 14 }];

    const result = await makeDecision({ content: "Email: a@b.com", detections, policies, riskScore: 10 });

    expect(result.action).toBe("REDACT");
    expect(result.sanitizedContent).not.toContain("a@b.com");
  });
});
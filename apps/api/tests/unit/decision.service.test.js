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

  // Phase 7: destination/role/risk-only policies (no DATA_TYPE condition)
  it("matches a role-based policy even with zero detections", async () => {
    const policies = [{
      id: "p3", priority: 10, name: "Interns require approval for everything", action: "REQUIRE_APPROVAL",
      conditions: [{ field: "USER_ROLE", operator: "EQUALS", value: "DEVELOPER" }]
    }];

    const asDeveloper = await makeDecision({ content: "hello", detections: [], policies, riskScore: 0, userRole: "DEVELOPER" });
    expect(asDeveloper.action).toBe("REQUIRE_APPROVAL");
    expect(asDeveloper.matchedPolicyIds).toContain("p3");

    const asAdmin = await makeDecision({ content: "hello", detections: [], policies, riskScore: 0, userRole: "ADMIN" });
    expect(asAdmin.action).toBe("ALLOW"); // condition doesn't match this role
  });

  it("matches a destination-only policy even with zero detections", async () => {
    const policies = [{
      id: "p4", priority: 10, name: "Block unapproved destinations", action: "BLOCK",
      conditions: [{ field: "DESTINATION_TYPE", operator: "EQUALS", value: "EXTERNAL_AI" }]
    }];
    const destinationContext = { destinationId: "chatgpt", destinationType: "EXTERNAL_AI", riskLevel: "MEDIUM" };

    const result = await makeDecision({ content: "hello", detections: [], policies, riskScore: 5, destinationContext });
    expect(result.action).toBe("BLOCK");
    expect(result.matchedPolicies).toEqual([{ id: "p4", name: "Block unapproved destinations", action: "BLOCK" }]);
  });

  // Phase 7 conflict resolution: precedence (BLOCK > REQUIRE_APPROVAL >
  // REDACT > ALLOW — decision.precedence.js) decides between a
  // detection-triggered policy and a context-only (destination) policy
  // that both matched the SAME request, not policy priority. Priority
  // only decides which single policy wins when several policies compete
  // for the same field (policy.evaluator.js's "first match wins" over a
  // priority-DESC-sorted list) — it does not compare across policies
  // that matched on different context.
  it("resolves a conflict between a detection policy (REDACT) and a destination policy (BLOCK) in favor of BLOCK, regardless of priority", async () => {
    const policies = [
      { id: "redact-emails", priority: 100, action: "REDACT", conditions: [{ field: "DATA_TYPE", operator: "EQUALS", value: "EMAIL" }] },
      { id: "block-unknown-destination", priority: 1, action: "BLOCK", conditions: [{ field: "DESTINATION_RISK", operator: "EQUALS", value: "HIGH" }] }
    ];
    const detections = [{ type: "EMAIL", sensitivity: "MEDIUM", start: 0, end: 5 }];
    const destinationContext = { destinationId: "some-random-tool", destinationType: "CUSTOM", riskLevel: "HIGH" };

    const result = await makeDecision({ content: "a@b.com", detections, policies, riskScore: 20, destinationContext });

    expect(result.action).toBe("BLOCK"); // BLOCK's precedence rank beats REDACT's, despite REDACT's higher priority
    expect(result.sanitizedContent).toBeNull(); // BLOCK never redacts
    expect(result.matchedPolicyIds).toEqual(expect.arrayContaining(["redact-emails", "block-unknown-destination"]));
  });
});
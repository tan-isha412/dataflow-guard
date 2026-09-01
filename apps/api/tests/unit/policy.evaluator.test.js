import { describe, it, expect } from "vitest";
import { policyMatches, findMatchingPolicy } from "../../src/modules/policy/policy.evaluator.js";

const blockCreditCards = {
  id: "p1",
  priority: 10,
  action: "BLOCK",
  conditions: [{ field: "dataType", operator: "EQUALS", value: "CREDIT_CARD" }]
};

const allowLowRisk = {
  id: "p2",
  priority: 1,
  action: "ALLOW",
  conditions: [{ field: "sensitivity", operator: "EQUALS", value: "LOW" }]
};

describe("policyMatches", () => {
  it("matches when all conditions are true", () => {
    expect(policyMatches(blockCreditCards, { dataType: "CREDIT_CARD" })).toBe(true);
  });

  it("does not match when a condition is false", () => {
    expect(policyMatches(blockCreditCards, { dataType: "EMAIL" })).toBe(false);
  });
});

describe("findMatchingPolicy", () => {
  it("returns the higher-priority match when multiple policies match", () => {
    const context = { dataType: "CREDIT_CARD", sensitivity: "LOW" };
    const result = findMatchingPolicy([blockCreditCards, allowLowRisk], context);
    // blockCreditCards has priority 10 vs allowLowRisk's 1, and the
    // repository sorts by priority DESC, so it comes first in the array
    expect(result.id).toBe("p1");
  });

  it("returns null when nothing matches", () => {
    expect(findMatchingPolicy([blockCreditCards], { dataType: "PHONE" })).toBeNull();
  });
});
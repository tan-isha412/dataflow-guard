import { POLICY_OPERATORS } from "@dataflow-guardian/shared";

// Checks ONE condition against ONE detection/context value.
function conditionMatches(condition, context) {
  const actualValue = context[condition.field];

  switch (condition.operator) {
    case POLICY_OPERATORS.EQUALS:
      return actualValue === condition.value;
    case POLICY_OPERATORS.NOT_EQUALS:
      return actualValue !== condition.value;
    case POLICY_OPERATORS.IN:
      return condition.value.includes(actualValue);
    case POLICY_OPERATORS.NOT_IN:
      return !condition.value.includes(actualValue);
    case POLICY_OPERATORS.GREATER_THAN:
      return actualValue > condition.value;
    case POLICY_OPERATORS.LESS_THAN:
      return actualValue < condition.value;
    case POLICY_OPERATORS.EXISTS:
      return actualValue !== undefined && actualValue !== null;
    default:
      return false;
  }
}

// A policy matches only if ALL of its conditions match (AND-only,
// deliberately — the architecture doc calls this out as a scoping
// decision to keep the evaluator predictable and testable).
export function policyMatches(policy, context) {
  return policy.conditions.every((condition) => conditionMatches(condition, context));
}

// Policies arrive pre-sorted by priority (see policy.repository.js).
// The FIRST match wins — this function stops at the first hit
// instead of collecting every matching policy.
export function findMatchingPolicy(policies, context) {
  return policies.find((policy) => policyMatches(policy, context)) ?? null;
}
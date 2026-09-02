/**
 * Mirrors packages/shared/src/types/decision.js DECISION_ACTIONS.
 * Duplicated (not imported) for the same reason as
 * content/adapters/destinationTypes.js: extension code that runs in the
 * browser can't resolve npm package specifiers, only relative/absolute
 * URLs. tests/decisionValidation.test.js imports the REAL shared package
 * and asserts these values match, so drift is a test failure.
 *
 * The extension NEVER decides what these mean — it only recognizes them
 * well enough to fail closed on anything it doesn't recognize. See
 * background/inspection/decisionValidation.js.
 */
export const DECISION_ACTIONS = Object.freeze({
  ALLOW: "ALLOW",
  REDACT: "REDACT",
  BLOCK: "BLOCK",
  REQUIRE_APPROVAL: "REQUIRE_APPROVAL"
});

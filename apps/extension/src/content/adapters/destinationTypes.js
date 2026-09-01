/**
 * Mirrors packages/shared/src/types/destination.js DESTINATION_TYPES.
 * Duplicated (not imported) because content scripts run as classic,
 * unbundled scripts in the browser and cannot resolve npm package
 * specifiers the way Node/Vitest can. Kept honest by
 * apps/extension/tests/destinationNormalization.test.js, which imports
 * the REAL @dataflow-guardian/shared package and asserts these values
 * match — so drift between the two is a test failure, not a silent bug.
 */
export const DESTINATION_TYPES = Object.freeze({
  EXTERNAL_AI: "EXTERNAL_AI"
});

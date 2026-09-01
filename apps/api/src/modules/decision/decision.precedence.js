import { DECISION_ACTIONS } from "@dataflow-guardian/shared";

// Higher index = wins when multiple actions could apply to the same
// piece of content. BLOCK always wins over everything else — you
// never want a REDACT policy to accidentally let blocked content through.
const PRECEDENCE_ORDER = [
  DECISION_ACTIONS.ALLOW,
  DECISION_ACTIONS.REDACT,
  DECISION_ACTIONS.REQUIRE_APPROVAL,
  DECISION_ACTIONS.BLOCK
];

export function resolveHighestPrecedence(actions) {
  return actions.reduce(
    (winner, action) =>
      PRECEDENCE_ORDER.indexOf(action) > PRECEDENCE_ORDER.indexOf(winner) ? action : winner,
    DECISION_ACTIONS.ALLOW
  );
}
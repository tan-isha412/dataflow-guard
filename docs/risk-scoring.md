# Risk Scoring

Each detection is weighted by sensitivity: LOW=1, MEDIUM=3, HIGH=7,
CRITICAL=15. A scan's total risk score is the sum of all detection
weights, PLUS a destination risk contribution (LOW=0, MEDIUM=5, HIGH=15,
CRITICAL=30 — see "Destination risk" below), capped at 100. See
`apps/api/src/modules/risk/risk.service.js`.

This is deliberately simple (linear, capped) rather than a trained
model — it's fully explainable to a customer asking "why did this
score 47," which matters more for this product's trust story than
marginal scoring accuracy would.

## Destination risk (Phase 7)

Where a prompt is headed matters as much as what's in it: the same
low-sensitivity text is a different risk sent to an approved internal
tool versus an AI site the organization has never seen before.
`apps/api/src/modules/destinations/destinations.service.js`'s
`resolveDestinationContext()` turns what the extension reports (a
logical id like `"chatgpt"`, from its adapter) into a risk level:

1. If the org has approved/registered a `Destination` row with a
   matching name (Destinations page), that row's own `riskLevel` wins —
   an admin's explicit judgment always overrides the default.
2. Otherwise, a short built-in list of well-known AI sites (ChatGPT,
   Claude, Gemini) defaults to MEDIUM.
3. Anything else unrecognized defaults to HIGH — fail closed, not
   fail open, for a destination the org has never seen before.
4. No destination reported at all (e.g. a manual Playground scan, not
   headed anywhere) contributes LOW/zero — there's no external site to
   be risky about.

A `Destination` marked `BLOCKED` by an admin short-circuits straight to
a BLOCK decision before detection/policy even run — see
`inspect.service.js`'s `blockedDestinationDecision()`.

## Policy context beyond detections

Policies aren't limited to matching a single detection's `DATA_TYPE`/
`SENSITIVITY` — they can also match purely on `DESTINATION_ID`/
`DESTINATION_TYPE`/`DESTINATION_RISK`/`USER_ROLE`/`RISK_SCORE`, with no
detection required at all (e.g. "require approval for any request to
an unrecognized destination"). `decision.service.js`'s `makeDecision()`
evaluates this "context-only" case once per request, in addition to
each individual detection, so a destination- or role-only policy still
gets a chance to fire on completely clean content.
# API Reference (v1, prefix `/api/v1`)

Every request/response below carries an `X-Request-Id` header
(`middleware/requestId.js`) — echoed from an inbound one if the caller
sent it, otherwise generated fresh. Server error responses also include
`error.requestId`. Use it to correlate a request across the API's own
logs (`[requestId] METHOD path → status`) and the structured
`"inspection completed"` log line for that same request.

## Auth
- `POST /auth/register` — create org + user, returns tokens
- `POST /auth/login` — returns tokens
- `POST /auth/refresh` — `{refreshToken}` → new `{accessToken, refreshToken}`

## Inspect
- `POST /inspect` — `{content, destinationId?, destinationType?, displayName?}` →
  `{action, status, riskScore, reason, matchedPolicyIds, matchedPolicies, detections, sanitizedContent, approvalRequestId, destination, requestId}`.
  `destinationId` is a free-form logical id (e.g. `"chatgpt"` from the
  browser extension's adapter), not a foreign key. `destinationType`/
  `displayName` are enrichment the extension's adapter already knows —
  the server re-derives the actual risk/type used in policy evaluation
  from its own `Destination` catalog + a small built-in default list
  (see `docs/risk-scoring.md`), never trusting the client's word for it.
  `organizationId` and the caller's role always come from the
  authenticated token, never from the request body — see
  `middleware/auth.js`.
  `matchedPolicies` is `[{id, name, action}]`, for displaying e.g.
  "Policy: External AI Credential Protection" without a second lookup.

### Policy conflict resolution

Two independent mechanisms, in this order:

1. **Which policy wins for a given field** (`policy.evaluator.js`):
   policies are fetched sorted by `priority` DESC, and the FIRST one
   whose conditions all match wins for that evaluation — higher
   `priority` always beats a lower one when both could apply to the
   same detection/context.
2. **Which ACTION wins across every match on one request**
   (`decision.precedence.js`): a single inspection can trigger several
   *different* policies at once — one per detection, plus at most one
   "context-only" policy matched on destination/role/risk alone with no
   specific detection (see `docs/risk-scoring.md`). Their actions are
   resolved by a fixed precedence, **not** by priority:
   `BLOCK > REQUIRE_APPROVAL > REDACT > ALLOW`. A REDACT policy at
   priority 100 never overrides a BLOCK policy at priority 1 that also
   matched — BLOCK always wins outright, because letting a REDACT rule
   silently downgrade a BLOCK would defeat the point of having BLOCK at
   all. Priority only ever decides a conflict *within* one field (e.g.
   two policies both keyed on `DATA_TYPE=EMAIL`), never across the
   detection-vs-context split.

An unrecognized `action` or condition `field`/`operator` is rejected at
policy-creation time (400, see Policy below) rather than silently
evaluating to a no-op later. A `disabled` policy (or one belonging to
another org) is never fetched for evaluation at all.

## Policy
- `GET /policy`, `POST /policy`, `PATCH /policy/:id`, `DELETE /policy/:id`
- `action` must be one of `ALLOW`/`REDACT`/`BLOCK`/`REQUIRE_APPROVAL`; each
  condition's `field`/`operator` must be one of the values in
  `packages/shared/src/types/policy.js`'s `POLICY_FIELDS`/`POLICY_OPERATORS`
  — anything else is a 400, not a silently-inert policy.

## Destinations
- `GET /destinations`, `POST /destinations`, `PATCH /destinations/:id/status`
  (`status: "APPROVED"|"UNAPPROVED"|"PENDING_REVIEW"|"BLOCKED"`).
  A `BLOCKED` destination short-circuits `/inspect` straight to `BLOCK`,
  before detection/policy evaluation even runs.

## Approvals
- `GET /approvals?status=`, `GET /approvals/:id`, `PATCH /approvals/:id/decide` — `{decision: "APPROVED"|"REJECTED"}`.
  `GET /:id` is what the extension polls (bounded, ~2 minutes) after a
  REQUIRE_APPROVAL decision to learn whether it was approved/rejected.

## Analytics
- `GET /analytics/risk-over-time?days=30`, `GET /analytics/detections-by-type`

## Audit
- `GET /audit?skip=&take=&eventType=`, `GET /audit/summary`

## Orgs
- `GET /orgs/me`, `PATCH /orgs/me`, `GET /orgs/members`,
  `POST /orgs/members/invite`, `PATCH /orgs/members/:userId/role`
- `PATCH /orgs/me/privacy-settings` — `{auditRetentionDays: number|null}`,
  admin-only (`org:manage`). `null` = retain audit/decision history
  indefinitely (the default); otherwise a nightly job deletes rows past
  that many days — see `docs/privacy.md`.

## Audit
- `GET /audit?eventType=`, `GET /audit/summary`

## Analytics
- `GET /analytics/risk-over-time?days=30`, `GET /analytics/detections-by-type`

All endpoints except `/auth/*` require `Authorization: Bearer <accessToken>`.
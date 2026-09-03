# Privacy Architecture (Phase 6)

DataFlow Guardian inspects prompt content to protect an organization
from data leaks — which means the product itself has to be careful not
to become a second, larger data-leak surface. This document describes
what's actually implemented, not an aspiration. It is **not** a
zero-knowledge system: the backend does see prompt content in order to
detect sensitive data in it. What it does is minimize what's collected,
never log or persist raw content, and give orgs a real (if narrow)
retention control.

## What the extension sends

`apps/extension/src/background/inspection/inspectionHandler.js` sends
exactly: `content`, `destinationId`, `destinationType`, `displayName`.
It deliberately does NOT forward `source`, `timestamp`, or
`applicationContext` (the current page URL, adapter id) that
`promptInterceptor.js` computes locally — the backend doesn't use them
for any detection/policy/risk decision, so sending them would just be
unused telemetry sitting in a request body and, in the URL's case, a
plainly unnecessary thing to transmit.

Two things are never sent as prompt data:

- **The auth token** — it goes in the `Authorization` header
  (`apiClient.js`), never in the request body alongside content.
- **organizationId** — the backend derives it from the verified JWT
  (`req.auth.organizationId` in `middleware/auth.js`), never from
  anything the client claims. The zod schema on `POST /inspect`
  (`inspect.routes.js`) doesn't even have a field for it — there's no
  key a client could set that would do anything.

## Local (client-side) inspection

The extension does exactly one local check before calling the backend:
if the composer is empty/whitespace-only, nothing is sent at all
(`chatgptAdapter.js`'s `onSubmitAttempt`) — there's nothing to inspect.

Deliberately NOT implemented: client-side regex/pattern detection for
API keys, credentials, etc. as a pre-filter. Two reasons:

1. **It would duplicate the backend's detection engine**, which the
   architecture is explicit about not doing — the backend is the one
   and only place a "this is sensitive" decision gets made.
2. **A local pre-filter used to skip the backend call is a bypass
   waiting to happen.** Any regex an attacker (or just an edge case)
   can construct around becomes a way to send genuinely sensitive
   content with zero inspection — worse than not having a local check
   at all. A local check used only to *decide whether to call the
   backend* is inherently a fail-open path.

If a future local detector is added, it should only ever be used to
show the user a faster/better-informed "inspecting" state, never to
skip calling `/inspect` — that always remains mandatory.

## Logging

Nothing in the inspection path logs prompt content, in the extension or
the backend:

- `apps/extension/src/background/inspection/inspectionHandler.js` and
  `service-worker.js`: no `console.*` call anywhere in the file ever
  references `payload.content` (enforced by
  `tests/inspectionHandler.test.js`'s assertion that `console.log` is
  never invoked in that path).
- `apps/api/src/modules/inspect/inspect.service.js`: the completion log
  line is metadata only — `requestId`, `organizationId`, `action`,
  `detectionCount`, `riskScore`, `destinationId`. An earlier version
  logged a "truncated content preview" via `truncateForAudit()`; for
  any prompt at or under the truncation length (a very plausible size
  for a short secret) that "truncation" was a no-op, so it logged the
  full sensitive value. It was removed outright — not tuned — because
  logging any amount of prompt content is the wrong default for this
  product, not just short ones.
- `apps/api/src/middleware/requestLogger.js` / `errorHandler.js`: log
  method/path/status/duration and the correlation id
  (`middleware/requestId.js`), never `req.body`.
- The audit trail (`emitAuditEvent`, called from `inspect.service.js`)
  stores `detectionTypes` (e.g. `["EMAIL"]`) and `matchedPolicies`
  (id/name/action), never the matched substring or the surrounding
  prompt text.

## Retention

`Decision` rows (one per inspection) never contain the original prompt
— only `sanitizedContent` for REDACT decisions (the safe, post-redaction
text, kept because it's what was actually sent onward) and structural
detection metadata (`type`, `sensitivity`, character offsets). `Approval`
rows likewise store `detections`, never raw content.

Organizations can opt into automatic deletion of old `AuditEvent`/
`Decision` rows via `Organization.auditRetentionDays`
(`PATCH /orgs/me/privacy-settings`, admin-only). Unset (`null`, the
default) means indefinite retention — deletion is opt-in, since the
audit log doubles as compliance evidence. A daily worker job
(`apps/worker/src/processors/auditAggregation.processor.js`) sweeps
every org that has set a window. Because neither table holds raw
content, this is storage hygiene, not a second line of defense against
a data leak — the real protection is that raw content was never stored
in the first place.

## What's intentionally not built

- **No "allow raw content in admin views" toggle.** There's no raw
  content anywhere in the system for such a toggle to reveal — building
  the flag without the underlying storage would be a UI element that
  lies about what the product does.
- **No configurable "fail open" mode.** The extension fails closed
  unconditionally on any API/auth/decision error (see
  `errorMapping.js`, `decisionValidation.js`). Phase 5 describes this as
  something that "should be configurable or conservatively fail closed
  for protected organizations" — a fail-*open* option is a security
  regression by definition, so rather than build a footgun the default
  (and only) behavior is the safe one.

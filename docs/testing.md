# Testing Strategy & Results (Phase 10)

Every number in this document is from an actual test run in this
session, on the date this document was written (2026-09-04), or from a
real code-inspection finding. Nothing here is estimated. Where
something couldn't be run in this sandboxed environment, that's stated
explicitly rather than assumed passing.

## Layered strategy

| Layer | Location | What it tests |
|---|---|---|
| Unit | `apps/api/src/**/*.test.js`, `apps/api/tests/unit/` | Pure logic: detectors, decision precedence, RBAC middleware in isolation, redaction, risk scoring, error handling |
| Integration | `apps/api/tests/integration/` | Real Express app + real Postgres + real Redis, via `supertest` — auth flows, RBAC across real endpoints, org isolation, rate limiting, policy/approval/audit CRUD |
| Extension unit | `apps/extension/tests/*.test.js` | Content-script/background logic in `happy-dom`, mocked messaging boundaries only (never mocked decision logic) |
| Browser E2E | `apps/extension/tests/browser/*.manual.cjs` | Real Chromium + real unpacked extension + real backend — the actual product, not mocks |
| Dashboard E2E | `apps/web/cypress/e2e/*.cy.js` | Real dev server + real backend via Cypress — see "Known gap" below |
| Performance | `apps/api/scripts/benchmark.js` | Real measured latency, in-process and full HTTP round-trip |
| Load | `apps/api/scripts/loadtest.js` | Real concurrent throughput/latency/error-rate against localhost only |

**"Do not create tests that merely test mocks instead of real behavior"**
was the standing instruction this phase — the integration and browser
E2E layers exist specifically because the unit layer alone can't prove
org isolation, RBAC-at-the-real-endpoint, or interception-under-a-real-
race-condition; those needed a real app/DB/browser, not a mock.

## Backend (apps/api) — results

```
Test Files  33 passed (33)
     Tests  140 passed (140)
```
Run against a real local Postgres + Redis, `redis-cli flushdb` +
`vitest.config.js`'s `globalSetup` clearing rate-limit keys before the
run (see "A real test-suite bug found this phase" below). Verified
**three consecutive back-to-back full runs** pass cleanly with no
manual cleanup in between — this specific scenario (re-running the
suite without resetting state) is what surfaced two of the three real
bugs below.

### Security engine coverage
- SAFE content → ALLOW (`inspect.flow.test.js`)
- Sensitive data detection: credit card, email, phone, AWS/GitHub keys,
  DB connection strings, IP addresses, generic secrets, custom
  org-defined patterns (`src/modules/inspection/*.test.js`, one file
  per detector)
- BLOCK/REDACT/REQUIRE_APPROVAL policy actions, including
  destination-aware policies (`DESTINATION_RISK` conditions) and a
  destination explicitly marked BLOCKED by an admin short-circuiting
  policy evaluation entirely (`inspect.flow.test.js`)
- Unknown/unrecognized destination treated as HIGH risk
  (`destinations.service.js`'s `resolveDestinationContext`, covered by
  `inspect.flow.test.js`)
- No matching policy + no detections → ALLOW; detections alone with no
  matching policy → still ALLOW (detection never blocks on its own —
  policies are the only enforcement source, `decision.service.js`)
- Policy conflict/priority resolution (`decision.precedence.test.js`,
  `policy.evaluator.js`) — highest-priority match wins, fixed severity
  order (BLOCK > REQUIRE_APPROVAL > REDACT > ALLOW) breaks ties

### Organization isolation (IDOR-style)
`tests/integration/organizationIsolation.test.js` +
`inspect.flow.test.js`'s client-supplied-`organizationId` test — cross-
org access to policies, destinations, approvals, audit, and a
client-claimed `organizationId` in a request body are all tested
against real endpoints with real tokens for two real orgs, not
mocked. Backend authorization only — the frontend hiding a link is
never relied on (confirmed: `req.auth.organizationId` from the verified
JWT is the only org-identity source in every service, see
`docs/security.md`).

### RBAC
`tests/integration/rbac.roles.test.js` — 31 tests: every one of the 5
real roles (ADMIN, SECURITY_ANALYST, APPROVER, DEVELOPER, VIEWER)
against 6 representative real endpoints plus a universal audit-read
check, using tokens signed the same way real login does. A denied role
gets a real `403 FORBIDDEN` from the actual route.

### Authentication security
`tests/integration/authSecurity.test.js` (7 tests) +
`authBruteForce.test.js` (1 test, real 15-attempt brute-force run) —
expired JWT, forged JWT, malformed/missing Authorization header,
`passwordHash` never in a response, JWT secret/`DATABASE_URL` never in
any response body across the whole suite, weak password rejected `400`
(not `500` — see the bugs section below), login brute-force → `429`
before the correct password is ever accepted. Logout-is-client-side-only
is documented as an intentional test (old token still works — see
`docs/security.md`), not treated as a bug to fix.

### Failure testing
See `docs/security.md`'s "Failure-mode behavior" section for the full
narrative. Summary of what was actually tested this phase, live, not
just unit-mocked:
- **Postgres down**: stopped the real service, curled a live server —
  confirmed a sanitized `500`/`INTERNAL_ERROR` response, no Prisma
  error code or connection detail leaked (a real bug, found and fixed
  — `errorHandler.js` previously only sanitized `.message`, not
  `.code`).
- **Redis down**: stopped the real service, curled `/inspect` and
  `/orgs/me` on a live server. Before the fix: requests hung
  indefinitely (confirmed via an 8s-timeout curl returning nothing) —
  a real availability bug, NOT the documented fail-open behavior,
  caused by `redisClient`'s `maxRetriesPerRequest: null` (required by
  BullMQ) meaning `.incr()` never rejects during an outage. After the
  fix (a bounded `withTimeout()` wrapper): requests complete in ~1.5s
  and succeed, verified live on two endpoints, plus an automated
  regression test (`tests/unit/rateLimit.test.js`) that mocks a Redis
  call that never resolves and asserts the middleware still calls
  `next()` within a bounded time.
- **Expired auth / malformed responses**: covered by
  `authSecurity.test.js` (expired/forged JWT) — the extension's own
  handling of a malformed/unexpected API response is covered by
  `apps/extension/tests/decisionValidation.test.js` (unit level; not
  re-verified live this session, see "not re-run this session" below).
- **Unsupported site**: `content_scripts.matches` scopes the extension
  to exactly two origins — verified live in the browser E2E run (see
  below), a non-matched site never shows any DataFlow Guardian UI and
  never intercepts anything.
- **The extension never treats an unknown/error state as ALLOW** — this
  is the fail-closed design documented and tested throughout
  `errorMapping.js`/`decisionValidation.js`'s unit tests, and verified
  live in the browser E2E run's "logged out mid-session" scenario
  below.

### Race conditions
Verified live in a real Chromium browser (not simulated) — see
"Browser E2E results" below for the full list (double-click dedup,
Enter+button both intercepted, SPA navigation, empty-prompt no-op).

## A real test-suite bug found this phase: non-idempotent test emails

Running the full suite twice in a row (a completely ordinary thing to
do locally or in CI) broke 3 test files: `orgs.privacySettings.test.js`,
`inspect.flow.test.js`, and `organizationIsolation.test.js` all used
**hardcoded, non-unique email addresses** to register their test users,
unlike every other file in the suite (which uses `` `x-${Date.now()}@...` ``).
Against a test database that isn't reset between runs, the second run's
`register` call got a real `409 Conflict`, leaving `accessToken`/
`organization` undefined — every downstream assertion in those files was
silently checking `undefined` data instead of what it claimed to test.
Fixed by giving every register call in those 3 files a unique
timestamped email, matching the rest of the suite's own convention.
Verified: **three consecutive full runs pass cleanly** with no manual
DB reset in between (see the run count above).

A second, related bug from the same investigation: mounting the rate
limiter globally (this phase's own change — see `docs/security.md`)
meant its Redis-backed counters persisted **across separate `vitest run`
invocations** within the same 60-second window (this project's `.env`
points the test suite's Redis at the same instance local dev uses —
there's no separate test Redis). A second back-to-back run inherited
the first run's rate-limit counts and legitimate requests started
getting real `429`s. Fixed with a `vitest.config.js` `globalSetup`
(`tests/globalSetup.js`) that clears `ratelimit:*` Redis keys before
the suite starts.

## Worker (apps/worker) — results

```
Test Files  1 passed (1)
     Tests  1 passed (1)
```
`tests/auditRetentionSweep.test.js` — real Postgres, verifies the
retention sweep only deletes rows past an org's own configured window
and never touches an org that hasn't opted in.

**Known gap, stated honestly**: `approvalExpiry.processor.js` has no
dedicated test file. It's covered indirectly (an approval's
`expiresAt` field and `scheduleApprovalExpiry` call are asserted in
`apps/api/tests/integration/inspect.flow.test.js`), but the worker
processor itself — the code that actually flips a stale approval to
EXPIRED — is untested in isolation. Not fixed this phase (Phase 10's
instruction was to prioritize correctness over feature count, and this
is a real, narrow, non-security-critical gap rather than a blocking
one), named here so it isn't silently missing from the record.

## Extension (apps/extension) — results

```
Test Files  13 passed (13)
     Tests  113 passed (113)
```
`happy-dom` environment. Boundaries that touch the real browser API
(messaging, storage) are the only things mocked — decision logic
(`errorMapping.js`, `decisionValidation.js`, `promptInterceptor.js`'s
dedup state machine) is exercised directly, unmocked.

## Browser E2E results (real Chromium, real unpacked extension, real backend)

Both scripts run fresh this session against the current codebase
(`node apps/extension/tests/browser/*.manual.cjs`, headless Chromium at
`/opt/pw-browsers`, live local API + Postgres + Redis):

**`prompt-interception.manual.cjs` — ALL ASSERTIONS PASSED.** Covers, in
one continuous real session: safe prompt → ALLOW; credit card → BLOCK
(nothing reaches the page); email → REDACT (sanitized text reaches the
page, original never does); AWS key → REQUIRE_APPROVAL (backend approval
row confirmed created); Enter-key submission intercepted identically to
button-click; a **synchronous double-click** (two native `MouseEvent`s
dispatched in the same tick, not two separate `.click()` calls a fast
backend could race past) produces exactly one message to the page;
empty prompt never triggers an inspection; an unsupported site
(`example.com`) is completely unaffected — no panel, no interception;
SPA navigation (`history.pushState`) doesn't break interception; logging
out mid-session makes the next submission show "Sign in required" and
fails closed (nothing reaches the page).

Real, measured, this run (extension → background → API → panel-settled,
milliseconds):
```json
{ "allow": 82, "block": 96, "redact": 83, "approval": 82 }
```

**`approval-resolution.manual.cjs` — ALL ASSERTIONS PASSED.** A
REQUIRE_APPROVAL decision, an admin approving it out-of-band via
`PATCH /approvals/:id/decide` (not through the extension), the
extension's bounded polling (~5s interval) picking up the change and
updating the panel to "Approved" — and confirming the extension does
**not** auto-resubmit the original content on approval (a deliberate
design choice: approval unblocks the *next* attempt, it doesn't replay
the old one).

## Dashboard Cypress E2E — NOT VERIFIED this session (environment limitation)

`apps/web/cypress/e2e/login.cy.js` and `playground.cy.js` exist and
contain real assertions against a real dev server (no mocking). Two
real, pre-existing bugs were found by code inspection and fixed:

1. **No `cypress/support/e2e.js` existed at all.** `cypress.config.js`
   doesn't set `supportFile: false`, so Cypress's default config
   requires that file to exist — without it, Cypress fails at config
   load, before either spec file could even start. Added.
2. **`playground.cy.js` calls `cy.login()`**, a custom command that was
   never defined anywhere in the repo — that spec could never have
   passed. Implemented it for real (`cypress/support/commands.js`): a
   genuine `cy.request()` POST to the real `/auth/register` endpoint
   (same one every other real registration in this codebase uses, no
   mocking), then seeding `localStorage` in the exact shape zustand's
   `persist` middleware produces for `authStore.js`.

**Both fixes are code-reviewed and logically sound but could NOT be
executed in this sandbox** — Cypress's own binary must be downloaded
from `download.cypress.io`, which this environment's network egress
policy blocks (confirmed via the proxy's own status endpoint: a
`connect_rejected`/reset on that exact host, the same policy-denial
class as other blocked hosts in this session, not a transient failure
worth retrying). **Mark this explicitly NOT VERIFIED — do not report
these two Cypress specs as passing.** The fix is real and should pass
in any environment with normal internet access; that claim itself is
untested here.

## Performance — real measured numbers

`scripts/benchmark.js`, 500 iterations + 20 warmup (discarded) per
measurement, against a live local server:

| Stage | p50 | p95 | p99 |
|---|---|---|---|
| Detection (in-process) | 0.008ms | 0.035ms | 0.059ms |
| Policy evaluation (in-process) | 0.005ms | 0.010ms | 0.047ms |
| Full `/inspect` HTTP round-trip | 2.135ms | 8.899ms | 9.947ms |

**Bottleneck identification** (per the instruction not to optimize
blindly): the security logic itself is not the bottleneck — both
stages are sub-0.1ms at p95, effectively free. The full request's
latency is dominated by sequential DB round-trips (decision insert,
audit event insert), not CPU work. These numbers are already well
within any reasonable interactive budget, so nothing was changed —
this is a finding to document, not a problem that needed fixing.

## Controlled local load test — real measured numbers

`scripts/loadtest.js`, refuses to run against anything but
`localhost`/`127.0.0.1`.

**Production rate-limit defaults**, 20 concurrent workers/orgs, 15s:
99.9% of 53,340 requests were legitimately rate-limited (`429`) within
about 2 seconds, 0 real errors — the limiter correctly protecting the
API under sustained burst load exactly as designed. (This means raw
throughput can't be read off this run — it's dominated by cheap 429
rejections, not real inspection work; see the next run.)

**Rate limit raised for this one measurement** (via the new
`RATE_LIMIT_GENERAL_MAX` env var — production default unchanged), 20
concurrent workers, 15s, real Postgres + Redis:
```
13,658 requests, 100% success, 0 errors
throughput: 909.6 req/s
latency: p50 20.82ms  p95 32.95ms  p99 43.04ms  max 81.82ms
```
Compared to the single-request benchmark's p50 of ~2.1ms, latency under
20-way concurrency is roughly 10x higher — an honest finding
(connection-pool/event-loop contention under load), stated rather than
hidden.

## What was NOT re-run/re-verified this session

- The extension's `decisionValidation.test.js`/`errorMapping.test.js`
  unit coverage for malformed API responses was not re-executed live
  against a real malformed response this session (it's covered at the
  unit level, included in the 113/113 count above, but not re-verified
  via a live fault-injection the way Postgres/Redis-down were).
- Cypress dashboard E2E — see above, blocked by network policy in this
  environment, not executed.
- The AWS Terraform infrastructure (`infra/aws/`) has never been
  applied against a real AWS account in this project — see
  `docs/deployment.md`.

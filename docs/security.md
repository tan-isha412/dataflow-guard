# Security Model (Phase 10)

What's actually implemented and verified, with file references and test
references so every claim here can be checked against real code. Where
something was reviewed and found NOT to be a problem, that's stated
explicitly rather than omitted — this document is meant to be checked
against, not just read.

## Authentication

JWT bearer tokens (`jsonwebtoken`), access (15m default) + refresh (7d
default), signed with `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET`
(`config/env.js`, required — the app refuses to start without them).
`middleware/auth.js`'s `requireAuth` verifies the token on every
protected route and sets `req.auth = { userId, organizationId, role }`
from its claims — **every downstream org-scoping decision derives from
this, never from anything a client sends in the body or a query
param** (see "Organization isolation" below).

Verified (`tests/integration/authSecurity.test.js`,
`tests/integration/authBruteForce.test.js`):
- An expired token (signed with a real `-10s` expiry) is rejected.
- A token signed with the wrong secret (forged) is rejected.
- An empty/malformed `Authorization` header is rejected.
- `passwordHash` never appears in any API response.
- Neither the JWT secret nor `DATABASE_URL` ever appears in any
  response body across the whole test suite.
- A weak password (`< 8 chars`) is rejected with `400`, not `500` (a
  real bug found and fixed this phase — see `docs/testing.md`).
- Login is rate-limited: 10 attempts/60s per IP
  (`RATE_LIMIT_LOGIN_MAX`, `middleware/rateLimit.js`, scope
  `auth-login`) — verified a 15-attempt brute-force run gets `429`
  before the correct password is ever accepted.

**Known, documented limitation — logout is client-side only.** There is
no server-side session/token blacklist; `AUTH_LOGOUT` just clears the
extension's stored token (`background/auth/authService.js`). A token
issued before logout remains valid until its own expiry (≤15
minutes). This is an explicit tradeoff of stateless JWT auth, not an
oversight — a real revocation list would need a persistent
denylist-until-expiry keyed by token, which doesn't exist in this
system. Documented, not silently accepted: this is exactly the kind of
gap a threat model should name (see `docs/threat-model.md`, "stolen
auth token").

**Known, documented limitation — multi-org login has no org
selector.** `loginUser()` (`auth.service.js`) picks
`memberships[0]` for a user belonging to more than one org, with no way
to choose which. Real, narrow impact (most users belong to one org);
worth fixing before this becomes a multi-tenant-per-user product, not
urgent for the current single-org-per-user usage pattern.

## RBAC

Five roles, defined once in `packages/shared/src/types/role.js`
(`ROLE_PERMISSIONS`) and enforced by `middleware/rbac.js`'s
`requirePermission()` on every route that needs it — **the backend is
authoritative**; the dashboard only conditionally renders controls
based on the same table, it never gates access.

| Role | Permissions |
|---|---|
| ADMIN | org:manage, users:manage, policies:write, destinations:write, approvals:decide, audit:read, inspect:run |
| SECURITY_ANALYST | policies:write, destinations:write, approvals:decide, audit:read, inspect:run |
| APPROVER | approvals:decide, audit:read, inspect:run |
| DEVELOPER | inspect:run, destinations:read |
| VIEWER | audit:read, destinations:read |

Verified end to end (`tests/integration/rbac.roles.test.js`, 31 tests):
every role tested against 6 representative real endpoints plus a
universal audit-read check — a role without a permission gets a real
`403 FORBIDDEN` from the actual route, not just a unit-tested
middleware in isolation.

**Minor finding, not fixed:** `GET /destinations` has no explicit
`requirePermission("destinations:read")` gate despite that being a
defined permission — currently any authenticated user of any role can
read their org's destinations. Low severity (destinations are
org-internal metadata, not sensitive per se, and every role has at
least `destinations:read` in the permission table anyway except
APPROVER, which doesn't need it but also isn't harmed by having it) —
noted here rather than silently left unmentioned.

## Organization isolation

Every multi-tenant table's row-level access is scoped by
`req.auth.organizationId` at the service layer, never trusted from a
client-supplied id. Verified two ways
(`tests/integration/organizationIsolation.test.js`,
`tests/integration/inspect.flow.test.js`):

- **IDOR by ID guessing/reuse**: fetching an Approval, Policy, or
  Destination that belongs to a different org returns `404`, not
  `403` or the actual data — a real object existing in another org is
  indistinguishable from one that doesn't exist at all
  (`approvals.service.js`'s `getApproval`, same pattern in
  `policy.service.js`/`destinations.service.js`).
- **Client-supplied `organizationId` is ignored outright** — `POST
  /inspect` accepts an `organizationId` field in its test payload
  specifically to prove it's never honored: the decision, and every
  DB row it writes, is scoped to the *authenticated* org regardless of
  what the body claims (`inspect.flow.test.js`, "ignores a
  client-supplied organizationId").

Confirmed by direct code reading (not just test coverage) that
`policy.service.js`, `destinations.service.js`, and
`approvals.service.js` all check `resource.organizationId ===
organizationId` before any mutation — this was verified during the
Phase 10 database review, not assumed.

## API error handling

`middleware/errorHandler.js` is the single place every error response
is shaped. Only `AppError` (a deliberate, service-authored error with a
curated `message`/`code`) passes its fields to the client unchanged.
Anything else — a raw thrown exception, a third-party library error, a
Prisma driver error — has **both** `.message` and `.code` replaced with
generic values (`"Something went wrong"` / `"INTERNAL_ERROR"`) before
the response is sent; the real error is still logged server-side with
the request's correlation id.

This was found incomplete once this phase: an earlier version only
sanitized `.message`, so a live Postgres outage leaked Prisma's own
error code (`"P1017"`) in the response body — a real information
disclosure (confirms the backend uses Prisma, and that there's a live
DB connectivity problem). Fixed and covered by a regression test
(`tests/unit/errorHandler.test.js`) and verified live against an
actual stopped Postgres instance. No response body in this system ever
contains a stack trace, a file path, or a driver-specific code.

## Failure-mode behavior (fail-open vs. fail-closed)

Deliberately different defaults for two different failure classes:

- **The inspection pipeline fails CLOSED.** The extension's
  `errorMapping.js`/`decisionValidation.js` treat any API error,
  timeout, malformed response, or auth failure as "do not submit" —
  there is no code path where an unknown/error state resolves to
  ALLOW. This is the actual security boundary and it degrades safe,
  never permissive.
- **The rate limiter fails OPEN.** If Redis itself is unreachable,
  `middleware/rateLimit.js` lets the request through rather than
  blocking the entire API on a non-security-critical dependency. This
  was a real bug this phase, not a theoretical concern: the shared
  Redis client has `maxRetriesPerRequest: null` (required by BullMQ),
  which means `redisClient.incr()` never *rejects* during an outage —
  it queues forever — so the rate limiter's own `catch` block (meant
  to fail it open) never ran, and a Redis outage silently became a
  full API outage instead. Fixed with an explicit 1.5s timeout wrapper
  around the Redis call; verified live by stopping Redis and confirming
  requests complete in ~1.5s instead of hanging, plus an automated
  regression test (`tests/unit/rateLimit.test.js`) that mocks a Redis
  call that never resolves and asserts the middleware still calls
  `next()` within a bounded time. See `docs/testing.md` for the full
  failure-testing matrix.

## Extension security review

- **Permissions** (`manifest.json`): `"permissions": ["storage"]`
  only — no `tabs`, no `webRequest`, no `<all_urls>`. `host_permissions`
  is scoped to the API origin only (`http://localhost:5000/*` in dev;
  the production build script sets it to the real API domain, never
  broader).
- **Content script exposure**: `content_scripts.matches` is exactly
  `["https://chatgpt.com/*", "https://chat.openai.com/*"]` — the
  content script never runs on any other origin.
  `web_accessible_resources` (adapter/interception/shared modules,
  needed so the content script's own dynamic imports resolve) is
  scoped to the same two origins, not exposed extension-wide.
- **Content scripts are never trusted as an authority.** The content
  script holds no JWT, makes no direct network call to the backend,
  and computes no ALLOW/BLOCK/REDACT/REQUIRE_APPROVAL decision itself
  — every decision comes from the background service worker's
  response, which comes from the real backend. A compromised or
  malicious page script cannot forge a decision by manipulating the
  content script's DOM-facing state.
- **Service worker message validation**
  (`background/service-worker.js`): every inbound
  `chrome.runtime.onMessage` handler checks `sender.id ===
  chrome.runtime.id` before acting — a message from any origin other
  than this extension's own contexts is rejected. An unrecognized
  message `type` falls through to an explicit `ERROR` response rather
  than being silently ignored or crashing the handler.
- **Token storage**: the JWT lives only in `chrome.storage` (via
  `background/auth/authService.js`), read/written only by the
  background service worker — the content script and popup both go
  through message-passing to reach it, never touching storage
  directly.
- **Cross-origin requests**: the only network calls the extension makes
  are to its own configured `API_BASE_URL` (background service worker
  only); the content script makes zero direct network calls.
- **CSP**: Manifest V3's default extension CSP (no custom
  `content_security_policy` override in `manifest.json`) already
  disallows remote script execution and `eval` in extension pages —
  not weakened anywhere in this codebase.

## Dependency security audit

Ran `npm audit --workspaces` against the real, installed tree — 18
advisories (3 critical, 5 high, 10 moderate), each triaged by actual
reachability rather than severity label alone:

- **`qs` (moderate, DoS) — real, reachable in production. FIXED.** Not
  via body-parsing (`app.js` only uses `express.json()`), but Express
  4's default `query parser` setting uses the bundled `qs` to parse
  `req.query` on *every* request, so a malformed query string was a
  genuine unauthenticated attack surface. First attempted in a
  network-restricted sandbox where dependency resolution proved
  unreliable across five attempts (one `npm install --force` even
  corrupted `package-lock.json`, reverted immediately rather than
  commit a broken lockfile — left as an explicit NOT VERIFIED finding
  at the time). Re-attempted in a follow-up session with reliable
  network access: added a root `package.json` `"overrides": {"qs":
  "^6.16.0"}`, then a full clean reinstall (`rm -rf node_modules
  package-lock.json && npm install`) — a plain `npm install` against
  the already-populated `node_modules` from the first attempt kept
  silently no-op'ing the override (an npm behavior, not a network
  issue), so the clean wipe was necessary either way. Verified: `npm ls
  qs --workspaces --all` shows `qs@6.16.0` everywhere with no
  `invalid`/`overridden` markers, `npm audit` no longer lists `qs` at
  all, and the full suite (140/140 API, 113/113 extension, 1/1 worker)
  plus a fresh browser E2E run (`prompt-interception.manual.cjs`, all
  assertions) pass with the new lockfile.
- **`tar` via `bcrypt`→`@mapbox/node-pre-gyp` (critical, several
  arbitrary file write/symlink CVEs) — build-time only. Still NOT
  fixed.** The vulnerable code runs inside node-pre-gyp's postinstall
  step (downloading bcrypt's prebuilt binary), never at runtime. Real
  exposure is supply-chain trust in the registry at install time, not
  a live attack surface. `bcrypt`'s own API (`hash`/`compare`,
  `password.util.js`) is stable across major versions, so a bump to
  `bcrypt@6` should be compatible; not attempted even in the follow-up
  session with reliable network — out of scope for that pass, which
  was scoped narrowly to `qs`.
- **`react-router`/`react-router-dom` (moderate, open redirect + SSR
  hydration injection) — verified NOT reachable.** `apps/web` is
  client-side-rendered only (no SSR anywhere), so the hydration CVE has
  no code path here at all. Grepped every `<Link to>`/`useNavigate`/
  `<Navigate>` call in `apps/web/src` — all six targets are hardcoded
  literal strings (`"/"`, `"/login"`, `"/register"`), zero
  attacker-controlled redirect targets. Confirmed non-issue for this
  app's actual usage; left un-upgraded (a v6→v7 bump is a real breaking
  migration with no live attack surface to justify it during a
  feature-freeze hardening pass).
- **`happy-dom` (critical, VM context escape), `vitest`/`vite`/`esbuild`
  chain (moderate, dev server request forwarding), `cypress`/
  `extract-zip`/`uuid` (high/moderate, installer symlink traversal +
  buffer bounds)** — all devDependency-only, never present in a running
  production process. `happy-dom` only simulates a DOM for the
  extension's own first-party unit test fixtures; esbuild's dev server
  is never run in this project's actual deployment (static build served
  by nginx); Cypress's vulnerable code only runs while its own
  installer downloads its test-runner binary, in a local/CI dev
  environment.

## Database review

Reviewed `prisma/schema.prisma` against the live schema
(`\d <table>` in psql) — see `docs/architecture.md` for the table list.

- **Real finding, fixed**: every multi-tenant table (`policies`,
  `decisions`, `destinations`, `approvals`, `audit_events`) was missing
  an index on `organizationId`, despite every real query filtering on
  it — Prisma does not auto-index a plain foreign-key scalar column,
  only `@id`/`@unique` fields. Added indexes matched to actual query
  shapes (not a blanket single-column index everywhere): composite
  `(organizationId, createdAt)` on `decisions`/`audit_events` (both are
  filtered by org then ranged/ordered by `createdAt` in
  `audit.repository.js`, `analytics.repository.js`, and the worker's
  retention sweep), `(organizationId, status)` on `approvals` (the
  approvals queue query), plain `(organizationId)` on `policies`/
  `destinations` (no secondary filter in their repositories). Migration
  applied, `prisma generate` succeeded, full suite still passes.
- **FK cascade behavior** is Prisma's default (`ON DELETE RESTRICT`
  everywhere). Reviewed and left as-is: there is no org- or
  user-deletion code path anywhere in the app that RESTRICT would ever
  block, so this isn't a bug, just an unexercised constraint. Worth
  revisiting if account/org deletion is ever built.
- **Sensitive data retention**: `Decision.sanitizedContent` stores the
  REDACT-decision text with detected spans masked — the surrounding
  prose is real message content, not just typed metadata (unlike
  `AuditEvent.metadata`, which never contains anything but labels/
  counts/ids, confirmed by reading every `emitAuditEvent` call site).
  This is intentional (an admin needs to see what was actually sent),
  scoped narrowly (only for REDACT, `null` for BLOCK/ALLOW — confirmed
  by `inspect.flow.test.js`), and covered by the same opt-in retention
  sweep as everything else — but it's a real, worth-stating distinction
  from "never stores content," not a claim this document glosses over.

## What this system does NOT claim to protect against

Stated explicitly, per the instruction not to claim protection this
system doesn't actually provide:

- A user who copies sensitive data manually (not through a monitored
  AI site's composer) is entirely outside this system's visibility.
- A compromised OS/browser with the ability to read `chrome.storage`
  directly, or to inject into the extension's own privileged contexts,
  is not defended against by anything in this codebase.
- There is no server-side token revocation — a stolen valid JWT works
  until its own expiry (see "Authentication" above).
- Detection is pattern-based (regex + a handful of structural checks),
  not ML-based content understanding — sensitive data that doesn't
  match a known pattern (an unusual internal ID format, a novel secret
  shape) will not be detected.

See `docs/threat-model.md` for the full threat-by-threat treatment.

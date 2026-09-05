# Threat Model (Phase 10)

A practical threat model for what this system actually is: a browser
extension that intercepts prompts to external AI sites, a backend that
inspects and enforces policy on them, and a dashboard for
administrators. Each entry states what's actually mitigated in this
codebase (with a file reference) and what residual risk remains — this
document does not claim protection the system doesn't provide.

---

### 1. Malicious employee (insider trying to exfiltrate data via an AI chat)

- **Asset**: sensitive company data (credentials, customer PII, source
  code fragments) an employee might paste into ChatGPT.
- **Threat**: an employee deliberately pastes sensitive content, hoping
  it goes through unnoticed.
- **Attack path**: type/paste sensitive content into the chat composer,
  submit.
- **Mitigation**: every submission on a matched site is intercepted
  before the page ever sees it (`promptInterceptor.js`), inspected
  server-side (`inspect.service.js`), and the org's policies decide
  ALLOW/BLOCK/REDACT/REQUIRE_APPROVAL — the employee cannot bypass this
  by editing the DOM or the request, since the decision comes from the
  backend, not from anything computed in page context. Every decision
  is audited (`emitAuditEvent`), including who made the attempt.
- **Residual risk**: an employee can still exfiltrate data through any
  channel this system doesn't monitor (a different, unmatched website;
  a screenshot; copy-pasting into a personal device). This system's
  visibility is scoped to the two matched origins
  (`chatgpt.com`/`chat.openai.com`) — real, and stated plainly rather
  than implied to be broader.

### 2. Compromised browser (malware/extension with elevated access)

- **Asset**: the user's session (JWT), and the ability to bypass
  interception entirely.
- **Threat**: malware or a malicious browser extension with the
  ability to read `chrome.storage` directly, or to inject code into
  privileged extension contexts.
- **Attack path**: read the stored JWT out of `chrome.storage`, or
  disable/patch the content script before it can intercept a
  submission.
- **Mitigation**: none, and this is stated explicitly rather than
  glossed over. A compromised browser with OS-level or
  browser-internals-level access is outside what any browser-extension
  architecture can defend against — the extension's own permission
  scope (`"permissions": ["storage"]` only, no broader capability) at
  least limits what a *page-level* attacker (not a fully compromised
  browser) can reach.
- **Residual risk**: high, and unmitigated by design. A genuinely
  compromised browser can defeat any client-side security control; this
  is a client-side enforcement point, not a substitute for endpoint
  security.

### 3. Malicious webpage (a compromised or hostile chatgpt.com-adjacent page)

- **Asset**: the extension's internal messaging channel, the JWT.
- **Threat**: a malicious page script tries to impersonate the
  extension's own messages to the background service worker, to
  extract the token or force a decision.
- **Attack path**: `window.postMessage` or a crafted
  `chrome.runtime.sendMessage` call from page context, pretending to be
  the content script.
- **Mitigation**: `background/service-worker.js` checks `sender.id ===
  chrome.runtime.id` on every inbound message — a message whose sender
  isn't this extension's own runtime is never acted on. The content
  script itself holds no token and makes no direct network call, so
  there's nothing sensitive for a page script to extract from it even
  if it could inject into that context. `content_scripts.matches` and
  `web_accessible_resources` are both scoped to exactly the two
  supported origins, not exposed browser-wide.
- **Residual risk**: low for the messaging channel specifically
  (verified by direct code reading, not just assumed). A compromised
  *page* cannot forge a background-service-worker message; a
  compromised *content script* (via an XSS on the target site itself)
  is a different, more severe class covered by #2 above.

### 4. Stolen authentication token

- **Asset**: a valid JWT (access token, ≤15m; refresh token, ≤7d).
- **Threat**: an attacker obtains a valid token (device theft, a
  logged network request, a compromised machine) and uses it directly
  against the API.
- **Attack path**: replay the stolen `Authorization: Bearer <token>`
  header against any protected endpoint.
- **Mitigation**: short access-token lifetime (15 minutes) bounds the
  exposure window once a token is known to be compromised, without
  requiring any revocation infrastructure.
- **Residual risk**: real and explicitly documented, not hidden. There
  is **no server-side revocation/blacklist** — logout is client-side
  only (clears `chrome.storage`; `docs/security.md`'s "Authentication"
  section). A stolen access token remains valid for up to 15 minutes,
  and a stolen refresh token remains valid for up to 7 days, regardless
  of logout. This is a known architectural limitation of stateless JWT
  auth in this system, not an oversight — a real fix requires a
  persistent denylist keyed by token, which doesn't exist here.

### 5. Malicious extension message (a compromised third-party extension)

- **Asset**: the same messaging channel as #3, from a different
  attacker position (another installed extension, not a page script).
- **Threat**: another browser extension with broader permissions tries
  to message this extension's background service worker directly.
- **Attack path**: `chrome.runtime.sendMessage(dfgExtensionId, ...)`
  from a different extension's own background context.
- **Mitigation**: the same `sender.id === chrome.runtime.id` check as
  #3 rejects this — `sender.id` for a message from a different
  extension is that *other* extension's id, never this one's.
- **Residual risk**: low, same reasoning as #3 — verified by code
  reading, this is a real, working guard, not an assumed one.

### 6. Unauthorized organization access (cross-tenant IDOR)

- **Asset**: every other org's policies, decisions, approvals,
  destinations, audit events, users.
- **Threat**: an authenticated user of Org A tries to read or modify
  Org B's data, by guessing/reusing an id or by claiming a different
  `organizationId`.
- **Attack path**: request another org's resource by id (e.g. `GET
  /approvals/<org-b-approval-id>`), or send a body/param claiming
  `organizationId` belongs to a different org.
- **Mitigation**: `req.auth.organizationId` (from the verified JWT,
  never from the client) is the only source of org identity used in
  every service-layer query and ownership check
  (`policy.service.js`/`destinations.service.js`/`approvals.service.js`
  all verify `resource.organizationId === organizationId` before
  acting). A cross-org resource lookup returns `404`, not `403` or the
  real data — existence itself isn't disclosed. Verified directly
  (`tests/integration/organizationIsolation.test.js`,
  `tests/integration/inspect.flow.test.js`'s client-supplied-
  `organizationId` test) across policies, destinations, approvals,
  audit, and inspection.
- **Residual risk**: low — this is the single most heavily tested
  security property in this codebase (dedicated IDOR-style tests plus
  code-level confirmation during the Phase 10 database review), and
  the one minor gap found (`GET /destinations` missing an explicit
  `requirePermission` gate — `docs/security.md`) is a role-scoping gap
  within an org, not a cross-org one.

### 7. API abuse (brute force, scraping, denial of service via volume)

- **Asset**: the API's own availability, and account credentials.
- **Threat**: automated high-volume requests — credential stuffing
  against `/auth/login`, or general request-flooding against any
  endpoint.
- **Attack path**: repeated requests from a single source (IP,
  unauthenticated) or a single compromised org account
  (authenticated).
- **Mitigation**: `middleware/rateLimit.js`, two independent limits
  (`app.js`) — a strict 10/60s on `/auth/login` specifically (the one
  endpoint where volume itself is the attack), and a general 100/60s
  on everything else, keyed by `organizationId` once authenticated or
  IP before that. Verified live: 15 failed login attempts trip `429`
  before the correct password is ever accepted
  (`tests/integration/authBruteForce.test.js`); a controlled local load
  test (`scripts/loadtest.js`) confirmed the general limiter correctly
  rejects >99% of a 20-worker sustained burst with zero real errors.
- **Residual risk**: the rate limiter fails OPEN if Redis is
  unreachable (a deliberate tradeoff — `docs/security.md`'s
  failure-mode section) — during a Redis outage, this specific
  protection is temporarily unavailable, though the inspection
  pipeline's own fail-closed behavior (the actual security-critical
  control) is unaffected since it doesn't depend on Redis.

### 8. Policy bypass (an employee or attacker trying to defeat detection/policy logic itself)

- **Asset**: the integrity of the ALLOW/BLOCK/REDACT/REQUIRE_APPROVAL
  decision itself.
- **Threat**: crafting content specifically to evade the pattern-based
  detectors, or racing the interception mechanism (double-submit,
  navigate-away-mid-inspection, rapid resubmission) to get unreviewed
  content through.
- **Attack path**: obfuscate a credit card number so the regex misses
  it; double-click submit hoping one request races past inspection;
  navigate away while an inspection is in flight.
- **Mitigation**: detection evasion via obfuscation is a real,
  unmitigated limitation of pattern-based detection (see "What this
  system does NOT claim to protect against" below) — but the
  *interception mechanism itself* was specifically tested against
  timing/race attacks: `promptInterceptor.js` dedups concurrent submit
  attempts by id (`activeSubmissionId`), verified against a real
  synchronous double-click firing two native click events in the same
  tick (not just two separate `.click()` calls, which a fast local
  backend could race ahead of) — confirmed via
  `tests/browser/prompt-interception.manual.cjs` in a real Chromium
  browser that exactly one message ever reaches the page. Enter-key and
  button-click submission are both intercepted identically. Navigation
  during an in-flight inspection is handled by
  `content/adapters/pageLifecycle.js` resetting interception state
  rather than letting a stale response act on a new page.
- **Residual risk**: pattern-based detection has real, acknowledged
  blind spots (see below) — this is about the *mechanism* being sound,
  not the *detection coverage* being exhaustive.

### 9. Prompt leakage (the security product itself becoming a data-leak surface)

- **Asset**: the actual prompt content being inspected.
- **Threat**: the backend or extension logging, storing, or exposing
  raw prompt content anywhere — logs, audit trail, API responses, error
  messages.
- **Attack path**: read application logs, the database, or an API
  response and find sensitive content that was supposedly protected.
- **Mitigation**: this is `docs/privacy.md`'s entire subject —
  summarized: no `console.*` call in the inspection path ever
  references prompt content (extension side enforced by a dedicated
  test asserting `console.log` is never called with the payload;
  backend side confirmed by reading every `emitAuditEvent`/`logger.*`
  call site in `inspect.service.js`), `Decision`/`AuditEvent` rows
  never contain raw content (only typed detection metadata, and for
  REDACT only the already-sanitized text — see `docs/security.md`'s
  database section for that one narrower exception), and error
  responses never include `req.body` (`errorHandler.js`).
- **Residual risk**: low, and directly verified rather than assumed —
  this session re-confirmed it by reading the actual call sites, not
  just trusting the prior phase's documentation.

### 10. Backend compromise (attacker gains code execution or DB access on the server)

- **Asset**: everything — the database, secrets, every org's data.
- **Threat**: a vulnerability in the API itself, or its infrastructure,
  gives an attacker direct access.
- **Attack path**: exploiting an application vulnerability, a
  misconfigured AWS resource, or a compromised dependency with runtime
  reach (see #11).
- **Mitigation**: defense in depth at the application layer (input
  validation via `zod` schemas + the shared `validate()` middleware on
  every route — found and fixed one real gap this phase where
  `auth.routes.js` called `schema.parse()` directly instead, causing a
  500 instead of a 400 on bad input; consistent org-scoping;
  `helmet` for standard HTTP security headers); at the infrastructure
  layer per `infra/aws/` (Terraform, not yet applied against a real AWS
  account — see `docs/deployment.md`): private subnets for RDS/
  ElastiCache, Secrets Manager for credentials rather than
  environment-baked secrets, TLS in transit.
- **Residual risk**: not meaningfully assessable beyond "the documented
  mitigations exist" — this system has never been through an actual
  penetration test or run against real production traffic, and the AWS
  infrastructure has never been deployed to a real account in this
  project (`docs/deployment.md` states this explicitly). A backend
  compromise would expose every org's policies/decisions/audit
  history/redacted-content records; it would NOT expose raw prompt
  content beyond what REDACT decisions already store in sanitized form
  (see #9), since raw content is never persisted in the first place.

### 11. Dependency/supply-chain compromise

- **Asset**: the integrity of the application's own code, transitively,
  via a compromised npm package.
- **Threat**: a dependency (direct or transitive) is compromised and
  ships malicious code, or a known vulnerability in a dependency is
  exploited.
- **Attack path**: either a supply-chain attack on a package this
  project depends on, or exploitation of a known vulnerability in a
  dependency (this phase's audit — `docs/security.md`'s dependency
  section — found `qs`'s reachable DoS via `req.query` to be the one
  genuinely live production finding; see "Mitigation" below for its
  status).
- **Mitigation**: a committed `package-lock.json` pins exact resolved
  versions (reproducible installs); `npm audit` was run against the
  real tree this phase and every finding was triaged by actual
  reachability, not just severity label, so effort went toward the one
  finding that's genuinely live in production rather than the ten that
  are devDependency-only. That finding (`qs`) has since been fixed —
  bumped to `6.16.0` via a root `package.json` override, verified with
  `npm ls`/`npm audit` showing no remaining `qs` advisory and the full
  test suite plus a fresh browser E2E run passing against the new
  lockfile.
- **Residual risk**: the `tar`→`bcrypt`→`@mapbox/node-pre-gyp` critical
  CVE chain (`docs/security.md`) remains unfixed — real exposure is
  limited to install-time supply-chain trust (the vulnerable code never
  runs at request-serving time), but it is still an open item, not a
  closed one. More broadly, a supply-chain compromise of any dependency
  this project trusts (direct or transitive) is not something a
  version pin defends against once that specific version is itself
  compromised — `npm audit` catches known, disclosed vulnerabilities in
  versions already flagged, not a novel compromise of a trusted
  package.

---

## Summary — what this document is NOT claiming

This system does not claim to prevent: insider exfiltration through
unmonitored channels, a fully compromised endpoint/browser, token
misuse within a stolen token's validity window (no revocation exists),
detection evasion via content obfuscation, or any threat whose
mitigation would require infrastructure that was never actually built
or verified in this project (a real deployed AWS environment, a
penetration test, a token-revocation store). Where a mitigation is
real, it's cited by file and by test. Where it isn't, that's stated as
plainly as the parts that are.

# DataFlow Guardian

An AI-aware data egress security platform: a browser extension
intercepts what an employee is about to send to an external AI site
(ChatGPT today), a backend security engine inspects it for sensitive
data (PII, credentials, secrets) and evaluates org-defined policies,
and the extension enforces the resulting decision — **allow**,
**redact**, **block**, or **require approval** — before the original
content ever reaches the AI site. An enterprise React dashboard gives
administrators visibility (audit activity, analytics, approvals) and
control (policies, organization/roles, privacy/retention settings) over
all of it.

## Stack
JavaScript throughout. React (dashboard) + Vite, Express (API),
PostgreSQL via Prisma, Redis + BullMQ (rate limiting, approval expiry,
audit retention sweep), a Manifest V3 browser extension (no bundler —
plain ES modules), Terraform (AWS infrastructure).

## Supported AI websites

`chatgpt.com` and `chat.openai.com` only, via one adapter
(`apps/extension/src/content/adapters/chatgptAdapter.js`). The
interception mechanism itself (`promptInterceptor.js`) is site-agnostic
— adding a new site means writing one more adapter (the DOM-specific
part) and adding its origin to `manifest.json`'s `content_scripts` and
`host_permissions`, not touching the security pipeline.

## Repository layout

```
apps/
  api/         Express API — auth, orgs/RBAC, policies, detection,
               risk, decisions, approvals, audit, analytics
  worker/      BullMQ job processors (approval expiry, audit retention)
  web/         React admin dashboard (Vite)
  extension/   Manifest V3 browser extension (the enforcement point)
packages/
  shared/      Types/constants shared by every app above
infra/aws/     Terraform + ECS task definitions (never applied to a real
               AWS account in this project — see docs/deployment.md)
docs/
  architecture.md    full pipeline, extension internals, AWS design
  security.md        auth/RBAC/org-isolation/dependency-audit/DB review
  threat-model.md     11 threats, each with mitigation + residual risk
  testing.md         real test counts, real benchmark/load-test numbers
  privacy.md         what's collected, what's never logged, retention
  risk-scoring.md    how risk scores and policy evaluation work
  api-reference.md   endpoints, policy conflict resolution
  deployment.md      AWS architecture, exact commands, what's verified
```

## Local development

```bash
npm install
docker compose up -d                 # Postgres + Redis only
npx prisma migrate dev --schema=apps/api/prisma/schema.prisma
npm run dev:api                      # terminal 1 — http://localhost:5000
npm run dev:web                      # terminal 2 — http://localhost:5173
npm run dev:worker                   # terminal 3
```

Copy `.env.example` to `.env` in `apps/api/` (and `apps/worker/` if
running the worker outside Docker) first — see that file for what every
variable does and which app reads it.

### Loading the extension locally

```bash
npm run build --workspace=@dataflow-guardian/extension
```

Then `chrome://extensions` → enable Developer mode → **Load unpacked**
→ `apps/extension/dist`. See `apps/extension/README.md` for the full
walkthrough, including the real-browser end-to-end test scripts in
`apps/extension/tests/browser/`.

## Testing

```bash
npm run test --workspaces
```

Runs Vitest across `api`, `worker`, and `extension` (unit + integration
— the API's integration tests need a real Postgres/Redis, see
`docker compose up -d` above). Real, measured results as of the last
Phase 10 run: **140/140** API tests, **113/113** extension tests,
**1/1** worker test — see `docs/testing.md` for the full breakdown,
including two real test-suite bugs found and fixed this phase
(non-idempotent test data, cross-run rate-limit state) and one honest
gap (`approvalExpiry.processor.js` has no dedicated test).

`apps/web` has two Cypress specs (`apps/web/cypress/e2e/`) exercising
real login/register and the sensitive-content Playground flow against
a real dev server — no mocking. Run headlessly with `npx cypress run`
inside `apps/web` (`npm run cypress` opens the interactive GUI instead)
— needs `npm run dev:api` and `npm run dev:web` running first. **Not
executed in this project's own development sandbox** — Cypress's
installer needs to download its own browser binary, which that
sandbox's network policy blocked; see `docs/testing.md` for the exact
failure and the two real bugs (a missing required support file, an
undefined custom command) found and fixed by code inspection despite
that.

The extension additionally has two real-Chromium end-to-end scripts
under `apps/extension/tests/browser/` (`*.manual.cjs`, not wired into
`npm test` since they need live infrastructure) covering the full
ALLOW/BLOCK/REDACT/REQUIRE_APPROVAL pipeline including the
approval-resolution polling flow, double-click/Enter-key race
handling, SPA navigation, and fail-closed logout — real results (both
scripts, all assertions, real measured timings) in `docs/testing.md`.

### Performance & load testing

```bash
node apps/api/scripts/benchmark.js   # real P50/P95/P99 latency, in-process + full HTTP
node apps/api/scripts/loadtest.js    # controlled local-only concurrent load test
```

Both need the API running against a real Postgres/Redis first. Real
numbers from the last run — full `/inspect` round-trip: p50 2.1ms, p95
8.9ms; sustained local throughput at 20 concurrent workers: 909.6
req/s, 100% success. Full results and bottleneck analysis in
`docs/testing.md`.

## Production deployment

See [docs/deployment.md](./docs/deployment.md) for the full AWS
architecture, exact commands, and — importantly — exactly what has and
hasn't actually been verified against a real AWS account.

## Demo script

A 5-minute walkthrough of the whole system, assuming a local dev setup
(`npm run dev:api`/`dev:web`, extension loaded per above, at least one
policy of each action type created via the dashboard's Policies page —
see `apps/extension/tests/browser/prompt-interception.manual.cjs` for
exact policy JSON if you'd rather script this than click through it):

1. Register/log in to the dashboard (`http://localhost:5173`) as an
   admin; note the Dashboard page's stat grid — all zero on a fresh org.
2. Policies page → create a BLOCK policy on `DATA_TYPE = CREDIT_CARD`,
   a REDACT policy on `DATA_TYPE = EMAIL`, a REQUIRE_APPROVAL policy on
   `DATA_TYPE = AWS_ACCESS_KEY`.
3. Load the extension, click the toolbar icon, log in with the same
   account.
4. Open `https://chatgpt.com`, type `Explain binary search.`, submit —
   the panel shows **Allowed**, the prompt reaches ChatGPT unchanged.
5. Type a synthetic credit card number, submit — panel shows **Request
   blocked** with the detected type and risk score; nothing reaches
   ChatGPT.
6. Type `My customer's email is john@example.com, please follow up.`,
   submit — panel shows **Sensitive data redacted**; what actually
   reaches ChatGPT has the email replaced, never the original.
7. Type a synthetic AWS access key, submit — panel shows **Approval
   required**; nothing reaches ChatGPT.
8. Back in the dashboard, Approvals page → the pending request appears
   with its detected category and destination → click Approve.
9. Dashboard/Audit Logs pages now show all of the above as real
   activity — stat counts, the risk-over-time chart, and a feed entry
   per decision with actor, destination, detection type, risk, and
   which policy matched.

Every step above is real functionality exercised end-to-end (this
exact sequence, run against a live local backend, is what
`apps/extension/tests/browser/prompt-interception.manual.cjs` +
`approval-resolution.manual.cjs` automate and assert on).

## Security & privacy

- `docs/security.md` — auth, RBAC, organization isolation, error
  handling, fail-open/fail-closed behavior, extension permissions
  review, dependency audit, database review.
- `docs/threat-model.md` — 11 concrete threats (malicious employee,
  compromised browser, malicious webpage, stolen token, unauthorized
  org access, API abuse, policy bypass, prompt leakage, backend/
  dependency compromise), each with what's actually mitigated and what
  residual risk remains — including what this system explicitly does
  **not** protect against.
- `docs/privacy.md` — what's collected, what's logged (and, more to the
  point, what's deliberately never logged), retention.
- `docs/risk-scoring.md` — how risk scores and destination-aware policy
  evaluation actually work.
- `docs/api-reference.md` — endpoints, including how policy conflicts
  are resolved.
- `docs/testing.md` — the full test strategy plus every real result
  (test counts, browser E2E, performance benchmark, load test) from
  the most recent hardening pass.

## Known limitations

Stated plainly rather than glossed over — see `docs/security.md` and
`docs/threat-model.md` for the full reasoning behind each:

- **No server-side session/token revocation.** Logout clears the
  extension's locally stored token only; a stolen access token remains
  valid for up to 15 minutes (its own expiry), a stolen refresh token
  for up to 7 days, regardless of logout.
- **One supported AI site** (ChatGPT) — see "Supported AI websites"
  above.
- **Detection is pattern-based**, not ML-based content understanding —
  sensitive data in a form that doesn't match a known pattern won't be
  caught.
- **A multi-org user's login has no org selector** — `loginUser()`
  picks the first membership; real but narrow impact for the current
  single-org-per-user usage pattern.
- **One known real dependency vulnerability, not yet fixed**: `qs`
  (via Express's default query-string parser) has a moderate DoS
  advisory with a known non-breaking fix that couldn't be safely
  applied in this project's own development sandbox — see
  `docs/security.md`'s dependency-audit section for exactly what and
  why, and the one-line fix once applied elsewhere.
- **The AWS infrastructure in `infra/aws/` has never been applied to a
  real AWS account** in this project — see `docs/deployment.md`.
- **Cypress dashboard E2E specs are unexecuted** in this project's own
  development sandbox (network-restricted); real bugs found in them
  were fixed by code inspection but not confirmed by an actual run —
  see `docs/testing.md`.

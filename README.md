# DataFlow Guardian

## What is DataFlow Guardian?

DataFlow Guardian is an AI-aware data egress security platform: a
browser extension intercepts what an employee is about to send to a
supported external AI site, a backend security engine inspects it for
sensitive data (PII, credentials, secrets) and evaluates the
organization's own policies, and the extension enforces the resulting
decision — **allow**, **redact**, **block**, or **require approval** —
before the original content ever reaches the AI site. A React
dashboard gives administrators visibility (audit activity, analytics,
approvals) and control (policies, organization/roles, privacy/retention
settings) over all of it.

## Problem

Organizations cannot easily control sensitive information employees
send to external AI systems. An employee pasting a customer's data, a
credential, or a secret into a public AI chat tool is invisible to
existing security tooling (DLP/CASB products largely don't inspect
what's typed into a web page's own composer) and irreversible once
sent — the organization has no visibility into it happening, no
policy enforcement over it, and no record of it afterward.

## Solution

DataFlow Guardian sits between the employee's browser interaction with
a supported AI system and the organization's security policies. Every
submission on a matched site is intercepted before the page ever sees
it, sent to a backend that detects sensitive data and evaluates the
org's own configured rules, and only then is the (possibly modified,
possibly blocked, possibly pending-approval) result actually delivered
— with every decision recorded for the organization's own audit trail.

## Architecture

```
Employee's browser (matched AI site)
        │
        ▼
Browser extension — intercepts submission, prevents the
        │            default action, shows nothing to the site yet
        ▼
Authenticated Guardian API (JWT bearer token)
        │
        ▼
Detection  →  Destination  →  Policy  →  Risk  →  Decision
        │
        ▼
   ALLOW / BLOCK / REDACT / REQUIRE_APPROVAL
        │
        ├──► Audit (every decision recorded, metadata only)
        │
        ▼
Extension enforces the decision — resubmits the original (ALLOW),
resubmits sanitized content (REDACT), or sends nothing (BLOCK /
REQUIRE_APPROVAL, until approved)
        │
        ▼
Administrator dashboard — policies, approvals, audit log, analytics,
        organization/roles, privacy settings — all scoped to one org
```

Full breakdown (extension internals, backend pipeline stage-by-stage,
database schema, AWS design): **[docs/architecture.md](./docs/architecture.md)**.

## Features

Only what actually works, end to end, verified by the automated suite
and/or a real browser run (see [Testing](#testing)):

- Real-time interception of prompt submissions on supported AI sites
  (button click and Enter key both handled identically)
- Sensitive-data detection: credit cards, emails, phone numbers, AWS/
  GitHub keys, database connection strings, IP addresses, JWTs, generic
  secrets, and org-defined custom patterns
- Destination-aware risk scoring (an unrecognized AI destination is
  treated as higher risk than a known one)
- Org-configurable policies with priority-ordered, conflict-resolved
  evaluation (BLOCK > REQUIRE_APPROVAL > REDACT > ALLOW when multiple
  policies match)
- Four enforced decisions — ALLOW, BLOCK, REDACT (partial masking for
  cards/phones/emails, full replacement otherwise), REQUIRE_APPROVAL
  (with bounded extension-side polling and a dashboard approve/reject
  flow)
- Five-role RBAC (ADMIN, SECURITY_ANALYST, APPROVER, DEVELOPER, VIEWER)
  enforced authoritatively on the backend
- Full organization isolation — every query is scoped to the
  authenticated org; a client-supplied `organizationId` is never
  trusted
- A metadata-only audit trail (never raw prompt content) with
  dashboard visibility, analytics, and opt-in automatic retention
  sweeps
- Login rate-limiting (brute-force protection) and general API
  abuse-resistance, both fail-open on a Redis outage so a
  non-security-critical dependency failure never becomes a full API
  outage
- A React admin dashboard: login, org/member management, policies,
  destinations, approvals, audit log, analytics

## Tech stack

- **JavaScript** throughout (no TypeScript)
- **React** + Vite (dashboard)
- **Node.js** + **Express** (API)
- **PostgreSQL** via **Prisma** (ORM + migrations)
- **Redis** + **BullMQ** (rate limiting, approval-expiry and
  audit-retention background jobs)
- **JWT** (`jsonwebtoken`) bearer-token authentication
- A **Manifest V3 browser extension** (no bundler — plain ES modules)
- **Docker** / Docker Compose (local Postgres + Redis, and production
  container images — see `apps/*/Dockerfile`)
- **AWS** via **Terraform** (designed, reviewed, not yet applied to a
  real account — see [Production deployment](#production-deployment))
- **Cypress** (dashboard E2E specs — see [Testing](#testing) for their
  current execution status)

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
  architecture.md      full pipeline, extension internals, AWS design
  security.md          auth/RBAC/org-isolation/dependency-audit/DB review
  threat-model.md      11 threats, each with mitigation + residual risk
  testing.md           real test counts, real benchmark/load-test numbers
  privacy.md           what's collected, what's never logged, retention
  risk-scoring.md      how risk scores and policy evaluation work
  api-reference.md     endpoints, policy conflict resolution
  deployment.md        AWS architecture, exact commands, what's verified
  MANUAL_TEST_PLAN.md  hands-on test plan for a full manual pass
```

## Local setup

```bash
npm install
docker compose up -d                 # Postgres + Redis only
npx prisma migrate dev --schema=apps/api/prisma/schema.prisma
```

Requires Node ≥20 (see root `package.json`'s `engines` field). If you'd
rather run Postgres/Redis yourself instead of Docker, point
`DATABASE_URL`/`REDIS_HOST`/`REDIS_PORT` (below) at them instead.

### Demo data (optional but recommended for a first run)

```bash
cd apps/api && npx prisma db seed
```

Seeds one synthetic organization, an admin and an employee account
(`demo-admin@acme.example` / `demo-employee@acme.example`, password
`password123` for both — clearly fake, development-only credentials,
see `apps/api/prisma/seed.js`), and one policy per decision action
(BLOCK/REDACT/REQUIRE_APPROVAL) — matching the [Demo
script](#demo-script) below exactly.

## Environment setup

Copy the example files, then fill in real values for anything beyond a
quick local test:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/worker/.env.example apps/worker/.env
```

| Variable | Required | Used by | Notes |
|---|---|---|---|
| `DATABASE_URL` | Yes | api, worker | Postgres connection string |
| `JWT_ACCESS_SECRET` | Yes | api | The app refuses to start without it — no insecure default |
| `JWT_REFRESH_SECRET` | Yes | api | Same — must differ from the access secret |
| `REDIS_HOST` / `REDIS_PORT` | No | api, worker | Default `localhost:6379` |
| `REDIS_PASSWORD` / `REDIS_TLS` | No | api, worker | Only needed against a managed instance (e.g. AWS ElastiCache with AUTH) |
| `ALLOWED_ORIGINS` | No | api | CORS allowlist; default `http://localhost:5173` |
| `API_PORT` / `API_PREFIX` | No | api | Defaults `5000` / `/api/v1` |
| `RATE_LIMIT_GENERAL_MAX` / `RATE_LIMIT_LOGIN_MAX` | No | api | Production defaults `100` / `10` per 60s — only override for a controlled local load test |
| `API_BASE_URL` | build-time | extension | Set by `scripts/build.js`, not read directly from `.env` — see below |

`JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` missing or empty is a hard
startup failure (`config/env.js`'s zod schema), by design — a missing
secret must never silently fall back to something insecure.

Never commit a real `.env` file (already covered by `.gitignore`) and
never put real credentials in documentation, commit messages, or code
comments — everything above is a variable *name*, not a value.

## Running the system

```bash
npm run dev:api       # terminal 1 — http://localhost:5000
npm run dev:web       # terminal 2 — http://localhost:5173
npm run dev:worker    # terminal 3
```

Verify the API is actually ready before using the dashboard/extension:

```bash
curl http://localhost:5000/health/ready
# {"status":"ready","dependencies":{"database":"up","redis":"up"}}
```

## Extension installation

```bash
npm run build --workspace=@dataflow-guardian/extension
```

Then, in Chrome or Edge:

1. Go to `chrome://extensions` (Edge: `edge://extensions`).
2. Enable **Developer mode** (toggle, top-right).
3. Click **Load unpacked**.
4. Select `apps/extension/dist`.

The extension icon appears in the toolbar; click it to log in with the
same account you use for the dashboard. See `apps/extension/README.md`
for more detail, including the real-browser end-to-end test scripts
under `apps/extension/tests/browser/`.

## Testing

```bash
npm run test --workspaces
```

Runs Vitest across `api`, `worker`, and `extension` (unit + integration
— the API's integration tests need a real Postgres/Redis, see
[Local setup](#local-setup) above). Real, measured results as of the
last hardening pass: **35/35** API test files (**146/146** tests),
**13/13** extension test files (**113/113** tests), **1/1** worker
test — see `docs/testing.md` for the full breakdown, every real bug
found and fixed along the way, and one honest gap
(`approvalExpiry.processor.js` has no dedicated test).

```bash
node apps/api/scripts/benchmark.js   # real P50/P95/P99 latency, in-process + full HTTP
node apps/api/scripts/loadtest.js    # controlled local-only concurrent load test
```

Both need the API running against a real Postgres/Redis. Real numbers
from the last run — full `/inspect` round-trip: p50 2.1ms, p95 8.9ms;
sustained local throughput at 20 concurrent workers: 909.6 req/s, 100%
success. Full results and bottleneck analysis in `docs/testing.md`.

`apps/web` has two Cypress specs (`apps/web/cypress/e2e/`) exercising
real login/register and the sensitive-content Playground flow against
a real dev server — no mocking. Run headlessly with `npx cypress run`
inside `apps/web` (`npm run cypress` opens the interactive GUI instead)
— needs `npm run dev:api` and `npm run dev:web` running first. **Not
executed in this project's own development environment** — Cypress's
installer needs to download its own browser binary, which has been
network-blocked in every environment this project has been developed
in so far; see `docs/testing.md` for the exact failure and two real
bugs (a missing required support file, an undefined custom command)
found and fixed by code inspection despite that.

The extension additionally has two real-Chromium end-to-end scripts
under `apps/extension/tests/browser/` (`*.manual.cjs`, not wired into
`npm test` since they need live infrastructure) covering the full
ALLOW/BLOCK/REDACT/REQUIRE_APPROVAL pipeline including the
approval-resolution polling flow, double-click/Enter-key race
handling, SPA navigation, and fail-closed logout — real results (both
scripts, all assertions, real measured timings) in `docs/testing.md`.

For a full hands-on pass (setup through failure cases, with a
fill-in-yourself Pass/Fail column), see
**[docs/MANUAL_TEST_PLAN.md](./docs/MANUAL_TEST_PLAN.md)**.

## Production deployment

`infra/aws/` contains Terraform for a real AWS architecture (VPC, RDS,
ElastiCache with AUTH+TLS, ECS Fargate, ALB+ACM, Route53, S3+CloudFront,
Secrets Manager) and `apps/*/Dockerfile`s for containerizing each
service. **None of this has been applied to a real AWS account in this
project** — it has been written and reviewed, not deployed. See
[docs/deployment.md](./docs/deployment.md) for the full design, exact
commands, and precisely what has and hasn't been verified.

## Demo script

A 5-minute walkthrough of the whole system, assuming a local dev setup
(`npm run dev:api`/`dev:web`, extension loaded per above) and the demo
data seeded (`npx prisma db seed`, above — its 3 policies already cover
every step here without any manual setup):

1. Log in to the dashboard (`http://localhost:5173`) as
   `demo-admin@acme.example` / `password123`; note the Dashboard page's
   stat grid — all zero on a fresh seed.
2. Load the extension, click the toolbar icon, log in with the same
   account (or `demo-employee@acme.example` to see it from a
   non-admin's perspective).
3. Open `https://chatgpt.com`, type `Explain binary search.`, submit —
   the panel shows **Allowed**, the prompt reaches ChatGPT unchanged.
4. Type a synthetic credit card number (`4532015112830366`), submit —
   panel shows **Request blocked** with the detected type and risk
   score; nothing reaches ChatGPT.
5. Type `My customer's email is john@example.com, please follow up.`,
   submit — panel shows **Sensitive data redacted**; what actually
   reaches ChatGPT has the email replaced, never the original.
6. Type a synthetic AWS access key (`AKIAIOSFODNN7EXAMPLE`), submit —
   panel shows **Approval required**; nothing reaches ChatGPT.
7. Back in the dashboard, Approvals page → the pending request appears
   with its detected category and destination → click Approve.
8. Dashboard/Audit Logs pages now show all of the above as real
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
  the most recent hardening passes.

**On security claims**: this document and its linked docs describe what
is actually implemented and verified — not "100% secure," "prevents
all data leakage," "zero-trust," "zero-knowledge," or "enterprise-grade
security" as unqualified marketing claims. Where a real limitation
exists (see below), it's named, not hidden behind language like that.

## Known limitations

- **No server-side session/token revocation.** Logout clears the
  extension's locally stored token only; a stolen access token remains
  valid for up to 15 minutes (its own expiry), a stolen refresh token
  for up to 7 days, regardless of logout.
- **One supported AI site** (ChatGPT) — see
  [Features](#features)/`docs/architecture.md`.
- **Detection is pattern-based**, not ML-based content understanding —
  sensitive data in a form that doesn't match a known pattern won't be
  caught.
- **A multi-org user's login has no org selector** — login picks the
  first membership; real but narrow impact for the current
  single-org-per-user usage pattern.
- **One known real dependency vulnerability, still unfixed**: the
  `tar`→`bcrypt`→`@mapbox/node-pre-gyp` critical CVE chain — real
  exposure is limited to install-time supply-chain trust (the
  vulnerable code runs only inside bcrypt's own binary-download
  postinstall step, never at request-serving time), but it's still
  open. See `docs/security.md`'s dependency-audit section.
- **The AWS infrastructure in `infra/aws/` has never been applied to a
  real AWS account** in this project — see `docs/deployment.md`.
- **Cypress dashboard E2E specs are unexecuted** in this project's own
  development environment (network-restricted); real bugs found in
  them were fixed by code inspection but not confirmed by an actual
  run — see `docs/testing.md`.
- **`approvalExpiry.processor.js` (the worker job that expires stale
  REQUIRE_APPROVAL requests) has no dedicated test** — covered only
  indirectly via an API integration test asserting the job gets
  scheduled, not that it correctly fires. See `docs/testing.md`.

# Architecture (Phase 10)

This is what's actually built and running, not an aspiration. Every
component named here exists in this repository at the path given.

## System overview

```
┌─────────────────┐        ┌──────────────────────────────────────────┐
│  Browser tab     │        │  Backend (apps/api)                     │
│  (chatgpt.com)   │        │                                          │
│                  │        │  POST /auth/*        (login/register)   │
│  content-script  │  HTTPS │  POST /inspect  ────► detect             │
│  intercepts      ├───────►│                       ────► risk score  │
│  submit, blocks  │        │                       ────► policy eval │
│  default action  │        │                       ────► decision    │
│                  │◄───────┤  GET  /approvals/:id (poll)              │
│  service worker  │        │  GET  /audit, /analytics, /policy, ...   │
│  holds JWT        │        │                                          │
│  (chrome.storage) │        └───────────┬──────────────────┬──────────┘
└──────────────────┘                    │                  │
                                          ▼                  ▼
                                  ┌──────────────┐   ┌──────────────┐
                                  │ PostgreSQL   │   │ Redis        │
                                  │ (Prisma)     │   │ rate limit,  │
                                  │ orgs/users/  │   │ BullMQ queues│
                                  │ policies/    │   └──────┬───────┘
                                  │ decisions/   │          │
                                  │ approvals/   │          ▼
                                  │ audit_events │   ┌──────────────┐
                                  └──────────────┘   │ apps/worker  │
                                                      │ approval     │
┌──────────────────┐                                 │ expiry,      │
│  React dashboard │  HTTPS (same API)                │ audit        │
│  (apps/web)       ├──────────────────────────────►  │ retention    │
│  admin login,     │                                 │ sweep        │
│  policies, audit, │                                 └──────────────┘
│  approvals,       │
│  analytics        │
└──────────────────┘
```

## Request pipeline (the core security decision)

`apps/api/src/modules/inspect/inspect.service.js` — `runInspection()` —
is the entire pipeline in one function, run once per `POST /inspect`:

1. **Resolve destination** (`destinations.service.js`) — maps the
   extension-reported `destinationId` (e.g. `"chatgpt"`) to a known
   destination's risk level, or treats an unrecognized one as `HIGH`
   risk. An admin-`BLOCKED` destination short-circuits everything below
   — no policy could ever override an explicit block.
2. **Detect** (`inspection/inspection.service.js` →
   `detectors/registry.js`) — pattern-based detectors (credit card,
   email, phone, AWS/GitHub keys, DB connection strings, IP addresses,
   generic secrets, org-defined custom patterns) run over the raw
   content. Pure, synchronous, no I/O — measured at p95 0.035ms per
   call in `scripts/benchmark.js` (see `docs/testing.md`).
3. **Score risk** (`risk/risk.service.js`) — combines detection
   sensitivity with destination risk level into a single 0-100 score.
4. **Fetch policies** (`policy/policy.repository.js`) — the requesting
   org's enabled policies, ordered by priority descending. The only DB
   read in the hot path besides the destination lookup.
5. **Decide** (`decision/decision.service.js` → `policy.evaluator.js` +
   `decision.precedence.js`) — finds the highest-priority matching
   policy; `decision.precedence.js` resolves ties/conflicts by a fixed
   severity order (BLOCK > REQUIRE_APPROVAL > REDACT > ALLOW) so two
   policies matching the same content never produce an ambiguous
   result. No matching policy + no detections = ALLOW; detections with
   no matching policy still ALLOW (detection alone never blocks —
   policies are the only source of enforcement, by design).
6. **Redact** (`redaction/redaction.service.js`), only for REDACT
   decisions — replaces matched spans right-to-left so earlier offsets
   stay valid, using a per-type strategy (partial mask for
   card/phone/email, full replacement otherwise).
7. **Persist** (`decision.repository.js`) — one `Decision` row per
   inspection, always, regardless of action.
8. **Create an approval** (`approvals.service.js`), only for
   REQUIRE_APPROVAL — schedules a 24h expiry job on the worker queue.
9. **Emit an audit event** (`audit/audit.emitter.js`) — metadata only
   (see `docs/privacy.md`), feeds the dashboard's activity feed and
   analytics.

Everything from step 2 onward is pure/local except the two DB
round-trips (destination + policy fetch, decision insert, audit
insert) — confirmed by direct in-process timing in
`scripts/benchmark.js`.

## Extension architecture (`apps/extension`)

Manifest V3, no bundler — plain ES modules, built by
`scripts/build.js` into `dist/` (dev vs. `--production` only changes
`API_BASE_URL`/`host_permissions`, never the code).

- **`content-script.js`** — matched only on `chatgpt.com`/
  `chat.openai.com` (`manifest.json`'s `content_scripts.matches`).
  Loads an **adapter** (`content/adapters/chatgptAdapter.js`, the only
  adapter implemented — see "Supported sites" below) that knows that
  one site's DOM (`#prompt-textarea`, `[data-testid="send-button"]`)
  and wires it to `content/interception/promptInterceptor.js`, which
  is 100% site-agnostic — it only knows "an attempt happened, here's
  the text," never any DOM detail.
- **`promptInterceptor.js`** — the actual interception state machine:
  dedups concurrent submit attempts (double-click, Enter+button race),
  shows an "inspecting" panel, sends `PROMPT_SUBMISSION` to the
  background, and acts on exactly one of ALLOW (re-submits the
  original)/REDACT (re-submits the sanitized text)/BLOCK (does
  nothing)/REQUIRE_APPROVAL (polls, bounded to ~2 minutes) — see
  `docs/testing.md`'s race-condition section for what's verified here.
- **`background/service-worker.js`** — the only code that holds the
  JWT (`chrome.storage`, via `background/auth/authService.js`) and
  makes the actual `fetch()` to the API
  (`background/inspection/apiClient.js` /
  `inspectionHandler.js`). Validates every inbound message's
  `sender.id === chrome.runtime.id` before acting on it, and falls
  through to an explicit `ERROR` response for any unrecognized message
  `type` rather than silently ignoring it.
- **`popup/`** — login/logout UI, reads session state via message to
  the background (never touches storage directly).

Content scripts are **never trusted as an authority** — they hold no
token, make no direct network calls, and every decision (ALLOW/BLOCK/
REDACT/REQUIRE_APPROVAL) comes from the backend, not from anything
computed in page context. See `docs/security.md`'s extension section
for the full permissions/message-validation review.

## Dashboard (`apps/web`)

React + Vite SPA, client-side rendered only (no SSR anywhere in this
app — relevant to `docs/security.md`'s dependency audit notes on
react-router). Talks to the same REST API as the extension, using the
same JWT bearer-token auth. Pages: Login/Register, Dashboard (stat
grid + risk-over-time chart via `recharts`), Policies, Destinations,
Approvals, Audit Log, Org/Members, Privacy Settings.

## Data layer

PostgreSQL via Prisma (`apps/api/prisma/schema.prisma`) — seven
tables, every one scoped by `organizationId` except `User` (a user's
org memberships live in the `Membership` join table, one row per
user-org pair with a `role`). See `docs/security.md`'s database
section for the indexing and org-isolation review.

Redis, two independent uses of one instance in local/dev
(`config/redis.js`): the rate limiter (`middleware/rateLimit.js`) and
BullMQ (approval-expiry, audit-retention-sweep queues consumed by
`apps/worker`). `maxRetriesPerRequest: null` is required for BullMQ and
is the reason the rate limiter needed its own explicit timeout wrapper
— see `docs/testing.md`'s failure-testing section.

## Background jobs (`apps/worker`)

Two BullMQ processors, both org-scoped:

- **`approvalExpiry.processor.js`** — one job scheduled per
  REQUIRE_APPROVAL decision, marks it EXPIRED at the 24h mark if still
  PENDING.
- **`auditAggregation.processor.js`** — a daily sweep that deletes
  `Decision`/`AuditEvent` rows older than an org's own
  `auditRetentionDays`, for orgs that have explicitly set one (opt-in,
  see `docs/privacy.md`).

## AWS deployment architecture (Terraform, `infra/aws/`)

Written and reviewed, **not applied against a real AWS account in this
project** (no AWS/Terraform-registry access in this environment) — see
`docs/deployment.md` for exactly what's verified vs. not.

VPC with public/private subnets, RDS (Postgres) and ElastiCache
(Redis, replication group with AUTH + TLS) in private subnets only,
ECS Fargate running the API/worker containers, an Application Load
Balancer terminating TLS (ACM certificate) in front of the API, Route53
DNS, S3 + CloudFront serving the built dashboard as a static site,
Secrets Manager for `DATABASE_URL`/JWT secrets/`REDIS_PASSWORD`
(injected as ECS task definition secrets, never baked into the image),
and IAM roles scoped per task.

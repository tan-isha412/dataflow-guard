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
infra/aws/     Terraform + ECS task definitions
docs/          deployment.md, api-reference.md, privacy.md, risk-scoring.md
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
`docker compose up -d` above). `apps/web` currently has no automated
test suite (verified manually — see `docs/deployment.md`'s smoke-test
section); the extension additionally has two real-Chromium end-to-end
scripts under `apps/extension/tests/browser/` (`*.manual.cjs`, not
wired into `npm test` since they need live infrastructure) covering the
full ALLOW/BLOCK/REDACT/REQUIRE_APPROVAL pipeline including the
approval-resolution polling flow.

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

- `docs/privacy.md` — what's collected, what's logged (and, more to the
  point, what's deliberately never logged), retention.
- `docs/risk-scoring.md` — how risk scores and destination-aware policy
  evaluation actually work.
- `docs/api-reference.md` — endpoints, including how policy conflicts
  are resolved.

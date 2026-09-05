# Manual Test Plan

A hands-on test plan for exercising DataFlow Guardian end to end,
covering setup through failure cases. Every test uses either the seed
data from `apps/api/prisma/seed.js` or values already exercised by the
automated suite (`docs/testing.md`) — nothing here requires guessing at
inputs that might not actually trigger the behavior being tested.

Fill in **Actual Result** and **Pass/Fail** yourself as you go. If a
test fails, note the exact error/response you saw — that's more useful
for follow-up than just "Fail."

**Synthetic test values used throughout** (none of these are real):
- Credit card: `4532015112830366`
- Email: `john@example.com`
- Phone: `415-555-0199`
- AWS access key: `AKIAIOSFODNN7EXAMPLE`

---

## 0. Setup

### SETUP-01 — Install dependencies and start infrastructure
- **Objective**: Confirm the repo installs and Postgres/Redis come up.
- **Preconditions**: Node ≥20, Docker available (or local Postgres 16 +
  Redis 7).
- **Steps**:
  1. `npm install` at the repo root.
  2. `docker compose up -d` (or start Postgres + Redis locally).
  3. `docker compose ps` (or equivalent) to confirm both are running.
- **Expected result**: Install completes with no errors; both services
  report healthy/running.
- **Actual result**: _____
- **Pass/Fail**: _____

### SETUP-02 — Configure environment
- **Objective**: Confirm `.env` files are set up correctly.
- **Preconditions**: SETUP-01 complete.
- **Steps**:
  1. Copy `apps/api/.env.example` → `apps/api/.env`.
  2. Copy `apps/worker/.env.example` → `apps/worker/.env`.
  3. Adjust `DATABASE_URL`/`REDIS_*` only if not using the default
     Docker Compose values.
- **Expected result**: Both `.env` files exist with real (non-placeholder)
  `JWT_ACCESS_SECRET`/`JWT_REFRESH_SECRET` values for anything beyond a
  quick local test.
- **Actual result**: _____
- **Pass/Fail**: _____

### SETUP-03 — Run migrations
- **Objective**: Schema applies cleanly to a fresh database.
- **Preconditions**: SETUP-01/02 complete.
- **Steps**: `npx prisma migrate dev --schema=apps/api/prisma/schema.prisma`
- **Expected result**: All migrations apply with no errors; ends with
  "Your database is now in sync with your schema."
- **Actual result**: _____
- **Pass/Fail**: _____

### SETUP-04 — Seed demo data
- **Objective**: Confirm the demo dataset loads.
- **Preconditions**: SETUP-03 complete.
- **Steps**: `cd apps/api && npx prisma db seed`
- **Expected result**: Console prints the seeded org id and both demo
  logins (`demo-admin@acme.example` / `demo-employee@acme.example`,
  password `password123`) plus 3 policy names.
- **Actual result**: _____
- **Pass/Fail**: _____

### SETUP-05 — Start backend
- **Objective**: API starts and reports ready.
- **Steps**:
  1. `npm run dev:api`
  2. `curl http://localhost:5000/health` → expect `{"status":"ok"}`
  3. `curl http://localhost:5000/health/ready` → expect
     `{"status":"ready","dependencies":{"database":"up","redis":"up"}}`
- **Expected result**: Both endpoints respond as above within a few
  seconds of startup.
- **Actual result**: _____
- **Pass/Fail**: _____

### SETUP-06 — Start frontend
- **Objective**: Dashboard dev server starts and loads.
- **Steps**: `npm run dev:web`, open `http://localhost:5173`.
- **Expected result**: The login page renders with no console errors.
- **Actual result**: _____
- **Pass/Fail**: _____

### SETUP-07 — Start worker
- **Objective**: Background job processor starts without error.
- **Steps**: `npm run dev:worker`
- **Expected result**: Console prints "DataFlow Guardian worker
  started, listening for jobs..." with no errors.
- **Actual result**: _____
- **Pass/Fail**: _____

### SETUP-08 — Build and load the extension
- **Objective**: Extension loads as an unpacked MV3 extension.
- **Steps**:
  1. `npm run build --workspace=@dataflow-guardian/extension`
  2. Chrome/Edge → `chrome://extensions` (or `edge://extensions`) →
     enable **Developer mode** (top-right toggle) → **Load unpacked** →
     select `apps/extension/dist`.
- **Expected result**: Extension loads with no errors, "DataFlow
  Guardian" appears in the extensions list and toolbar, version
  matches `apps/extension/manifest.json`.
- **Actual result**: _____
- **Pass/Fail**: _____

---

## 1. Authentication

### AUTH-01 — Dashboard login (valid credentials)
- **Objective**: An admin can log into the dashboard.
- **Preconditions**: SETUP-04, SETUP-06 done.
- **Steps**: Go to `http://localhost:5173/login`, enter
  `demo-admin@acme.example` / `password123`, submit.
- **Expected result**: Redirected to the Dashboard page; stat grid
  renders (all zero on a fresh seed).
- **Actual result**: _____
- **Pass/Fail**: _____

### AUTH-02 — Dashboard login (wrong password)
- **Objective**: Invalid credentials are rejected with a clear message.
- **Steps**: Log in with `demo-admin@acme.example` / `wrong-password`.
- **Expected result**: Stays on the login page; shows "Invalid email or
  password" (not a raw error, not a stack trace).
- **Actual result**: _____
- **Pass/Fail**: _____

### AUTH-03 — Extension login
- **Objective**: The extension's own popup login works independently of
  the dashboard.
- **Preconditions**: SETUP-08 done.
- **Steps**: Click the toolbar icon → log in with
  `demo-employee@acme.example` / `password123`.
- **Expected result**: Popup switches to the signed-in view, showing the
  email, organization name, and role ("DEVELOPER").
- **Actual result**: _____
- **Pass/Fail**: _____

### AUTH-04 — Extension logout
- **Objective**: Logout actually clears the session.
- **Preconditions**: AUTH-03 done.
- **Steps**: Click **Logout** in the popup.
- **Expected result**: Popup returns to the login view immediately.
- **Actual result**: _____
- **Pass/Fail**: _____

### AUTH-05 — Registering a brand-new organization
- **Objective**: Self-service signup works.
- **Steps**: Go to `/register`, fill in a new email/password/org name,
  submit.
- **Expected result**: Redirected straight into the new (empty)
  Dashboard, logged in as ADMIN of the new org.
- **Actual result**: _____
- **Pass/Fail**: _____

---

## 2. Extension on ChatGPT — core decision flows

Preconditions for this whole section: extension loaded (SETUP-08),
logged in via the popup as `demo-employee@acme.example` (AUTH-03), demo
policies present (SETUP-04). Open `https://chatgpt.com` in a tab with
the extension enabled.

### CHATGPT-01 — Adapter recognizes the page
- **Objective**: The extension actually activates on ChatGPT.
- **Steps**: Open `https://chatgpt.com`, open the browser console.
- **Expected result**: A `[DataFlow Guardian] adapter matched: chatgpt`
  debug log appears (with dev console logging enabled); no errors.
- **Actual result**: _____
- **Pass/Fail**: _____

### ALLOW-01 — Safe prompt is allowed through unchanged
- **Objective**: Normal content passes with no friction.
- **Steps**: Type `Explain binary search.` in the composer, submit.
- **Expected result**: A brief "Checking with DataFlow Guardian…" panel
  appears, then **Allowed** (auto-dismisses after ~2s); the exact typed
  text reaches ChatGPT unmodified.
- **Actual result**: _____
- **Pass/Fail**: _____

### BLOCK-01 — Sensitive content is blocked outright
- **Objective**: A BLOCK policy stops content from ever reaching the site.
- **Steps**: Type `My card number is 4532015112830366` (matches the
  seeded "Block credit cards" policy), submit.
- **Expected result**: Panel shows **Request blocked**, names the
  detected type (`CREDIT_CARD`) and a risk score; the composer's
  content is **not** sent to ChatGPT (no new message appears in the
  conversation).
- **Actual result**: _____
- **Pass/Fail**: _____

### REDACT-01 — Sensitive content is redacted, not blocked
- **Objective**: A REDACT policy sanitizes rather than blocks.
- **Steps**: Type `My customer's email is john@example.com, please
  follow up.`, submit.
- **Expected result**: Panel shows **Sensitive data redacted**; the
  message that actually reaches ChatGPT has the email address masked
  (e.g. `************.com`) — never the original address.
- **Actual result**: _____
- **Pass/Fail**: _____

### APPROVAL-01 — Sensitive content requires approval
- **Objective**: A REQUIRE_APPROVAL policy blocks pending a decision.
- **Steps**: Type `Our staging key is AKIAIOSFODNN7EXAMPLE`, submit.
- **Expected result**: Panel shows **Approval required** with a
  reference id; nothing reaches ChatGPT yet.
- **Actual result**: _____
- **Pass/Fail**: _____

### APPROVAL-02 — Approving from the dashboard updates the extension
- **Objective**: The approval loop closes end to end.
- **Preconditions**: APPROVAL-01 just created a PENDING approval.
- **Steps**: In the dashboard (logged in as `demo-admin@acme.example`),
  go to **Approvals**, find the pending request, click **Approve**.
  Back in the ChatGPT tab, wait up to ~5-10 seconds (the extension polls
  every 5s).
- **Expected result**: The panel updates to **Approved**, telling you to
  submit again to send it. It does **not** auto-resubmit the original
  content on its own.
- **Actual result**: _____
- **Pass/Fail**: _____

### APPROVAL-03 — Rejecting from the dashboard
- **Objective**: A rejected approval is reflected too.
- **Steps**: Repeat APPROVAL-01 with a different AWS key value, then in
  the dashboard click **Reject** instead of Approve.
- **Expected result**: Panel updates to show the rejection; content
  never reaches ChatGPT.
- **Actual result**: _____
- **Pass/Fail**: _____

### CHATGPT-02 — Enter-key submission is intercepted the same way
- **Objective**: Both submission paths (button click, Enter key) get
  inspected identically.
- **Steps**: Type a safe prompt, press **Enter** instead of clicking
  send.
- **Expected result**: Same "Checking…" → **Allowed** flow as ALLOW-01.
- **Actual result**: _____
- **Pass/Fail**: _____

### CHATGPT-03 — Unsupported site is unaffected
- **Objective**: The extension never activates outside its supported
  sites.
- **Steps**: Open any other website (e.g. `https://example.com`), open
  the console.
- **Expected result**: No DataFlow Guardian panel ever appears, no
  adapter-matched log; the site behaves exactly as it would without the
  extension installed.
- **Actual result**: _____
- **Pass/Fail**: _____

---

## 3. Dashboard

Preconditions: logged in as `demo-admin@acme.example`, and CHATGPT-01
through APPROVAL-03 above already run (so there's real activity to
look at).

### DASH-01 — Overview reflects real activity
- **Objective**: Stat grid isn't fake/static.
- **Steps**: Go to the Dashboard page.
- **Expected result**: "Requests inspected," "Allowed," "Blocked,"
  "Redacted," "Pending approval" counts match what you actually did
  above (not zero, not placeholder numbers).
- **Actual result**: _____
- **Pass/Fail**: _____

### DASH-02 — Empty state on a fresh organization
- **Objective**: A brand-new org doesn't look broken.
- **Steps**: Register a new org (AUTH-05), go straight to its Dashboard.
- **Expected result**: Stat grid shows zeros (not blank/broken), and
  charts/activity feed show a clear "no activity yet" message rather
  than an empty chart or blank space.
- **Actual result**: _____
- **Pass/Fail**: _____

### POLICIES-01 — View existing policies
- **Objective**: Seeded policies list correctly with readable labels.
- **Steps**: Go to the Policies page.
- **Expected result**: All 3 seeded policies appear with human-readable
  action labels ("Block", "Redact", "Require approval" — not raw
  `BLOCK`/`REQUIRE_APPROVAL` enum text).
- **Actual result**: _____
- **Pass/Fail**: _____

### POLICIES-02 — Create a new policy
- **Objective**: Policy creation actually takes effect.
- **Steps**: Click **+ New policy**, create one for `DATA_TYPE = PHONE`,
  action Redact, priority 5, submit. Then in ChatGPT, submit `Call me at
  415-555-0199`.
- **Expected result**: New policy appears in the list immediately; the
  phone number gets redacted on the next submission.
- **Actual result**: _____
- **Pass/Fail**: _____

### AUDIT-01 — Audit log shows every decision
- **Objective**: Every inspection is recorded, with no raw prompt
  content.
- **Steps**: Go to Audit Logs.
- **Expected result**: One entry per inspection you triggered above,
  each showing the action taken, detected type(s), risk score, and
  destination — never the actual prompt text or the specific sensitive
  value that was detected.
- **Actual result**: _____
- **Pass/Fail**: _____

### AUDIT-02 — Filter audit log by event type
- **Objective**: The filter control actually filters.
- **Steps**: Use the audit log's event-type filter to select only
  blocked events.
- **Expected result**: List narrows to only BLOCK-related entries.
- **Actual result**: _____
- **Pass/Fail**: _____

### ANALYTICS-01 — Charts render real data
- **Objective**: Risk-over-time and detections-by-type charts reflect
  real activity, not sample data.
- **Steps**: Go to Analytics.
- **Expected result**: Both charts show real points from your test
  activity above; a fresh org with no activity shows a clear "no data
  yet" message instead of a blank chart.
- **Actual result**: _____
- **Pass/Fail**: _____

### DESTINATIONS-01 — Destinations populate automatically
- **Objective**: Destinations aren't manually configured, they're
  observed.
- **Steps**: Go to Destinations.
- **Expected result**: "chatgpt" appears, having been recorded
  automatically the first time you submitted a prompt to it — nothing
  here needed to be manually added first.
- **Actual result**: _____
- **Pass/Fail**: _____

### ORG-01 — Organization/members page
- **Objective**: Admin can see and manage members.
- **Steps**: Go to the Organization page.
- **Expected result**: Both `demo-admin@acme.example` (ADMIN) and
  `demo-employee@acme.example` (DEVELOPER) are listed with their real
  roles.
- **Actual result**: _____
- **Pass/Fail**: _____

### ORG-02 — Invite a new member
- **Objective**: Invite flow works for an existing account.
- **Preconditions**: Have a second, already-registered account handy
  (e.g. register one via AUTH-05 in an incognito window first).
- **Steps**: On the Organization page, invite that account's email with
  role VIEWER.
- **Expected result**: New member appears in the list with role VIEWER.
- **Actual result**: _____
- **Pass/Fail**: _____

### ORG-03 — Cannot demote the last admin
- **Objective**: The organization can't be locked out of admin access.
- **Preconditions**: `demo-admin@acme.example` is the ONLY admin in its
  org (fresh seed, before ORG-02's invite is promoted to admin).
- **Steps**: On the Organization page, try changing
  `demo-admin@acme.example`'s own role to VIEWER.
- **Expected result**: Change is rejected with a clear message (some
  variation of "every organization must keep at least one
  administrator"); the role does not actually change.
- **Actual result**: _____
- **Pass/Fail**: _____

### PRIVACY-01 — Set an audit retention window
- **Objective**: Privacy settings actually persist.
- **Steps**: On the Organization page's Privacy settings, set retention
  to 30 days, save.
- **Expected result**: Saves without error; reloading the page still
  shows 30 in the field (or as the placeholder).
- **Actual result**: _____
- **Pass/Fail**: _____

---

## 4. RBAC

For each row, log in with a token/account holding that role (the
fastest way locally: use `apps/api/tests/integration/rbac.roles.test.js`
as a reference for exactly which real endpoints each role can/cannot
reach, or manually invite accounts at each role via ORG-02 and log into
each in a separate browser profile).

### RBAC-01 — VIEWER cannot create a policy
- **Steps**: As a VIEWER, attempt to create a policy (via the dashboard
  UI, or directly: `POST /api/v1/policy`).
- **Expected result**: `403 Forbidden`; the dashboard's own UI should
  also not present a working "create policy" control for this role.
- **Actual result**: _____
- **Pass/Fail**: _____

### RBAC-02 — DEVELOPER can run inspections but not manage policies
- **Steps**: As a DEVELOPER, submit a prompt via the extension (should
  work), then attempt to create a policy (should fail).
- **Expected result**: Inspection succeeds normally; policy creation is
  rejected with 403.
- **Actual result**: _____
- **Pass/Fail**: _____

### RBAC-03 — APPROVER can decide approvals but not create policies
- **Steps**: As an APPROVER, approve/reject a pending approval (should
  work), then attempt to create a policy (should fail).
- **Expected result**: Approval decision succeeds; policy creation
  returns 403.
- **Actual result**: _____
- **Pass/Fail**: _____

### RBAC-04 — Every role can read the audit log
- **Steps**: As each role (VIEWER included), open Audit Logs.
- **Expected result**: All roles can view it — `audit:read` is
  universal.
- **Actual result**: _____
- **Pass/Fail**: _____

---

## 5. Organization isolation

### ISO-01 — Cannot see another organization's policies
- **Objective**: No cross-tenant data leakage.
- **Preconditions**: Two separate organizations exist (e.g. the seeded
  org, plus one from AUTH-05).
- **Steps**: Log in as an admin of Org A. Note a policy id from Org B
  (via its own admin session, or from a previous API response). Attempt
  `GET /api/v1/policy/<org-B-policy-id>` while authenticated as Org A.
- **Expected result**: `404 Not Found` — never Org B's actual data,
  never a 403 that would confirm the id exists.
- **Actual result**: _____
- **Pass/Fail**: _____

### ISO-02 — Cannot see another organization's approvals
- **Steps**: Same pattern as ISO-01, but with an approval id from Org B.
- **Expected result**: `404 Not Found`.
- **Actual result**: _____
- **Pass/Fail**: _____

### ISO-03 — Dashboard never shows another org's audit log
- **Steps**: While logged in as Org A's admin, open Audit Logs.
- **Expected result**: Only Org A's events ever appear, regardless of
  how much activity Org B has.
- **Actual result**: _____
- **Pass/Fail**: _____

### ISO-04 — A client-claimed organizationId is ignored
- **Objective**: The backend never trusts client-supplied org identity.
- **Steps**: As Org A, call `POST /api/v1/inspect` with a body that
  includes an `organizationId` field pointing at Org B, containing
  content that would only be blocked under Org A's own policies.
- **Expected result**: The decision is made using Org A's policies
  (the authenticated org), completely ignoring the claimed
  `organizationId` in the body.
- **Actual result**: _____
- **Pass/Fail**: _____

---

## 6. Failure cases

### FAIL-01 — Backend unavailable
- **Objective**: The extension fails closed, never open, when it can't
  reach the API.
- **Steps**: Stop the API (`Ctrl+C` on `npm run dev:api`). In ChatGPT,
  submit a prompt.
- **Expected result**: Panel shows an error state ("DataFlow Guardian
  unavailable" or a connection-problem message); the prompt is **not**
  sent to ChatGPT.
- **Actual result**: _____
- **Pass/Fail**: _____

### FAIL-02 — Database unavailable
- **Objective**: A DB outage produces a clean error, not a leak of
  internal details.
- **Steps**: Stop Postgres. Call any authenticated endpoint (e.g.
  `GET /api/v1/orgs/me`) or check `GET /health/ready`.
- **Expected result**: `/health/ready` reports `"database":"down"`; any
  other call returns a generic `500`/`"INTERNAL_ERROR"` with no stack
  trace, SQL, connection string, or file path in the response body.
- **Actual result**: _____
- **Pass/Fail**: _____

### FAIL-03 — Redis unavailable
- **Objective**: A Redis outage degrades gracefully (rate limiting
  fails open) rather than taking down the API.
- **Steps**: Stop Redis. Call `POST /api/v1/inspect` with valid auth and
  safe content.
- **Expected result**: Request still succeeds normally (inspection
  itself doesn't depend on Redis); it does not hang — completes within
  a couple of seconds even though the rate limiter's own Redis call is
  failing.
- **Actual result**: _____
- **Pass/Fail**: _____

### FAIL-04 — Expired/invalid token
- **Objective**: An expired or tampered token is rejected cleanly.
- **Steps**: Log into the dashboard, then manually corrupt the stored
  access token (DevTools → Application → Local Storage → edit the
  `dataflow-guardian-auth` entry's `accessToken` value), then navigate
  to a protected page or trigger any API call.
- **Expected result**: You're redirected to the login page rather than
  seeing a broken/stuck page or a raw error.
- **Actual result**: _____
- **Pass/Fail**: _____

### FAIL-05 — Logged out mid-session in the extension
- **Objective**: The extension fails closed if the session disappears
  while a ChatGPT tab is still open.
- **Steps**: With the extension logged in and a ChatGPT tab open, open
  the popup and log out. Back in ChatGPT, submit a prompt.
- **Expected result**: Panel shows "Sign in required"; the prompt is
  **not** sent.
- **Actual result**: _____
- **Pass/Fail**: _____

### FAIL-06 — Unsupported/unrecognized destination
- **Objective**: An unrecognized destination is treated as higher risk,
  not silently allowed.
- **Steps**: Call `POST /api/v1/inspect` directly with a
  `destinationId` that has never been seen before (e.g.
  `"totally-new-ai-tool"`) and content that matches a
  `REQUIRE_APPROVAL`-on-`DESTINATION_RISK=HIGH` policy (create one if
  not already present).
- **Expected result**: The unrecognized destination is scored HIGH
  risk and the matching policy applies — it is not silently allowed
  just because the system has never seen it before.
- **Actual result**: _____
- **Pass/Fail**: _____

### FAIL-07 — Malformed/empty submission
- **Objective**: An empty prompt is never sent for inspection at all.
- **Steps**: Click the ChatGPT send button with an empty composer.
- **Expected result**: No inspection request is made, no panel appears
  — nothing to inspect.
- **Actual result**: _____
- **Pass/Fail**: _____

### FAIL-08 — Rapid double-submission
- **Objective**: A double-click or double-Enter never results in two
  inspections or a stale approval being applied to new content.
- **Steps**: Type a prompt, then click the send button twice in very
  rapid succession (or press Enter twice quickly).
- **Expected result**: Exactly one inspection happens, exactly one
  outcome is shown and (if allowed) exactly one message reaches
  ChatGPT — never two.
- **Actual result**: _____
- **Pass/Fail**: _____

### FAIL-09 — Navigating away during an in-flight inspection
- **Objective**: A decision for an old page/conversation is never
  applied after navigating away.
- **Steps**: Submit a prompt that will require approval (e.g. an AWS
  key), and *before* the panel settles, navigate to a different
  conversation (or `chatgpt.com/` root) within the same tab.
- **Expected result**: No stale panel/decision bleeds into the new
  page; if you now submit a fresh prompt on the new page, it gets its
  own independent inspection.
- **Actual result**: _____
- **Pass/Fail**: _____

### FAIL-10 — Login brute-force protection
- **Objective**: Repeated failed logins get rate-limited.
- **Steps**: Attempt to log in with the wrong password for
  `demo-admin@acme.example` more than 10 times in under a minute.
- **Expected result**: After enough attempts, the response becomes
  "Too many requests" (429) rather than continuing to check the
  password — and the *correct* password is also rejected while
  rate-limited.
- **Actual result**: _____
- **Pass/Fail**: _____

---

## Notes on what this plan does NOT cover

- Load/performance characteristics — those are covered by
  `apps/api/scripts/benchmark.js` and `scripts/loadtest.js`
  (`docs/testing.md` has the real measured numbers).
- The Cypress dashboard E2E specs (`apps/web/cypress/e2e/`) exercise
  login and the sensitive-content Playground programmatically — useful
  as a second, automated check of AUTH-01/02 and BLOCK-01/ALLOW-01-style
  behavior, but they could not be executed in this project's own
  development sandbox (see `docs/testing.md`); if you have normal
  internet access, `npx cypress run` inside `apps/web` should work.
- Actual AWS deployment — nothing in this system has been deployed to a
  real AWS account; `docs/deployment.md` describes the design only.

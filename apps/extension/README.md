# DataFlow Guardian — Browser Extension

Manifest V3 extension that acts as the enforcement point of DataFlow
Guardian: it inspects a user's prompt before submission to an external AI
site, sends it to the DataFlow Guardian API for a security decision, and
enforces the result. All security logic (policies, risk scoring,
decisions) lives in the backend — the extension never re-implements it.

## Status: Phase 1–9 complete

- **Phase 1** — MV3 skeleton, internal message passing.
- **Phase 2** — Login/logout against the real backend, session storage,
  session restoration, transparent access-token refresh.
- **Phase 3** — AI-website adapter architecture (ChatGPT only for now).
- **Phase 4** — Real prompt detection + submission interception on
  ChatGPT: finds the composer, intercepts click/Enter submission before
  it reaches the site, extracts the prompt, sends it for inspection.
- **Phase 5** — Enforces the backend's decision before anything reaches
  ChatGPT: ALLOW submits the original, REDACT submits the sanitized
  version (never the original), BLOCK submits nothing, and
  REQUIRE_APPROVAL submits nothing and polls the backend for the human
  decision (bounded, ~2 minutes) rather than leaving the user stuck.
- **Phase 6–8** — data minimization (only content + destination sent,
  never a token or org id, never the page URL/telemetry the backend
  doesn't use), fail-closed distinguishable error states, destination-
  aware policy/risk on the backend side.
- **Phase 9** — production build: `--production` build swaps the
  hardcoded dev `API_BASE_URL`/`host_permissions` for a real HTTPS API
  origin, refuses to build against plain HTTP. See "Production build"
  below.

**Honest limitation:** `chatgptAdapter.js`'s DOM selectors were never
verified against the live chatgpt.com site — this environment has no
network route to it. They were built to match ChatGPT's known composer
shape and degrade gracefully (multiple selector candidates, generic
fallback) if stale. Everything downstream of "an element was found" —
interception, dedup, message passing, decision enforcement, redaction-
before-send — is verified in a real Chromium browser against a synthetic
page built to the same DOM shape; see `tests/browser/`.

## Structure

```
manifest.json
src/
  background/
    service-worker.js        Message router; owns extension + auth state
    auth/
      authService.js          login/logout/getSession/restoreSession
      apiClient.js              fetch wrapper: login, refresh, authenticatedRequest, timeout handling
      authStorage.js             chrome.storage.local, tokens vs. profile split
      jwt.js                       decode/expiry-check (reads claims, doesn't verify)
    inspection/
      inspectionHandler.js      orchestrates one PROMPT_SUBMISSION: validate -> session check -> POST /inspect -> validate decision
      submissionValidation.js    defensive validation of the content-script's message shape
      decisionValidation.js      fail-closed guard: only a recognized, well-formed decision is ever acted on
      errorMapping.js             maps apiClient errors to a PROMPT_SUBMISSION_RESULT outcome (never "ALLOW")
  content/
    content-script.js        Runs on chatgpt.com/chat.openai.com; resolves
                               an adapter, starts the prompt interceptor,
                               pings background with normalized destination
    adapters/
      baseAdapter.js           AiWebsiteAdapter contract + defineAdapter() validator
      chatgptAdapter.js         ChatGPT implementation: locate composer, extract/write text,
                                  intercept click/Enter submission, re-submit an approved/
                                  redacted prompt without re-triggering interception
      registry.js                resolveAdapter(url) -> adapter | null
      pageLifecycle.js            watches pushState/replaceState/popstate (SPA nav)
      destinationTypes.js         DESTINATION_TYPES, mirrors packages/shared
    interception/
      promptInterceptor.js      the Phase 4/5 state machine: intercept -> inspect -> enforce.
                                  Dedupes concurrent attempts, discards stale/superseded
                                  responses (navigation, prompt edited mid-inspection)
      ui.js                      small shadow-DOM panel for the 7 user-facing states
  popup/
    popup.html/.js/.css      Login form (logged-out) or user/org/role + logout (logged-in)
  shared/
    config.js                 API_BASE_URL
    messageTypes.js             chrome.runtime message type constants + SUBMISSION_OUTCOMES
    messaging.js                  sendToBackground() helper
    storage.js                     general (non-auth) extension state
    decisionActions.js              mirrors packages/shared DECISION_ACTIONS
tests/
  *.test.js                  Vitest unit tests (see Test below)
  browser/
    prompt-interception.manual.cjs  real-Chromium end-to-end verification (see below)
    synthetic-chatgpt.html            the DOM shape it drives
```

## Adding a new AI-website adapter (e.g. Claude)

1. Create `src/content/adapters/claudeAdapter.js` implementing the
   `AiWebsiteAdapter` contract from `baseAdapter.js` (`defineAdapter({...})`).
2. Add it to the `ADAPTERS` array in `src/content/adapters/registry.js`.
3. Add its hostname(s) to `manifest.json`'s `content_scripts.matches` and
   `web_accessible_resources.matches`.

Nothing else changes — the content script, background, and popup only
ever talk to the adapter contract, never to a specific site's DOM. The
adapter itself must never contain policy/risk/detection/authorization
logic — it only reads/writes the page and reports what happened.

## Build

```bash
npm run build --workspace=@dataflow-guardian/extension
```

Validates `manifest.json` and stages an unpacked copy into `dist/`. No
bundler is used — plain ES modules, loaded directly by Chrome. This is
the **dev** build: `dist/` points at `http://localhost:5000`.

### Production build

```bash
API_BASE_URL=https://api.yourcompany.com/api/v1 \
  npm run build:production --workspace=@dataflow-guardian/extension
```

Same output (`dist/`), but `scripts/build.js` rewrites two things in the
copied files only (never in `src/`):

- `src/shared/config.js`'s `API_BASE_URL` constant
- `manifest.json`'s `host_permissions` entry, to the new origin

It refuses to build (non-zero exit) if `API_BASE_URL` is missing, still
the localhost default, or not `https://` — shipping an extension that
sends auth tokens/inspection content over plain HTTP is a real
vulnerability, not a configuration nicety. `dist/` is then a clean,
production-configured, loadable extension — zip it as-is for
distribution (see "Load into Chrome / Edge" below for the unpacked
flow; there is no Chrome Web Store publishing step here, by design —
see the root README's Phase 9 notes).

## Test

```bash
npm run test --workspace=@dataflow-guardian/extension
```

Vitest unit tests: adapter contract, ChatGPT adapter DOM interaction
(real DOM via `happy-dom`, not hand-rolled fakes — composer detection,
text extraction/writing, click/Enter interception, empty-input skip,
loop prevention via `submitApproved`), registry resolution/fault
isolation, destination normalization (cross-checked against the real
`@dataflow-guardian/shared` package), page lifecycle (SPA navigation),
JWT claim decoding/expiry, submission/decision validation (fail-closed),
error-to-outcome mapping, the `promptInterceptor` state machine (ALLOW/
BLOCK/REDACT/REQUIRE_APPROVAL, dedup, stale-content race guard, auth/
availability failures, `stop()` cancellation), and the UI panel.

### Real-browser end-to-end verification

```bash
# 1. Postgres + Redis running, backend running (see root README)
# 2. npm run build --workspace=@dataflow-guardian/extension
node apps/extension/tests/browser/prompt-interception.manual.cjs
```

Drives a **real Chromium** with the **real unpacked extension** through
the full pipeline against a live backend: registers an org, creates
BLOCK/REDACT/REQUIRE_APPROVAL policies, logs in through the actual popup,
then types and submits prompts into a synthetic ChatGPT-shaped page
(same composer/button DOM shape `chatgptAdapter.js` expects), served for
the real `https://chatgpt.com` origin via Playwright request
interception — so `manifest.json`'s `content_scripts.matches` genuinely
applies. Verifies, by reading what actually reached the page (not just
what the UI claims): a safe prompt is allowed through unchanged; a
credit number is blocked and never reaches the page; an email is
replaced with sanitized text and the original never reaches the page; an
AWS key creates a real pending approval in the backend and blocks
submission; Enter-key submission; rapid double-click dedup; empty-prompt
skip; an unsupported site is completely unaffected; SPA navigation
doesn't break interception; and logging out mid-session fails closed
rather than silently allowing. Prints real measured timings. Not wired
into `npm test` — it needs live infrastructure the unit tests don't.

```bash
node apps/extension/tests/browser/approval-resolution.manual.cjs
```

Same harness, one additional scenario: after REQUIRE_APPROVAL, an admin
decides the approval out of band (`PATCH /approvals/:id/decide`, exactly
what the dashboard's Approvals page does) and the test confirms the
extension's poll picks it up and updates the panel to "Approved" —
without ever auto-resubmitting the original content.

Both scripts accept `CHROMIUM_EXECUTABLE_PATH`, `API_BASE_URL`, and
`HEADLESS` as environment variables.

## Load into Chrome / Edge (developer mode)

1. Run the build (above), or point directly at `apps/extension/`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. **Load unpacked** → select `apps/extension/dist` (or `apps/extension/`).
4. Make sure the backend is running at `http://localhost:5000` (see the
   root README) — the popup's login talks to it directly.
5. Click the toolbar icon: log in with an existing DataFlow Guardian
   account (register one via the web app or `POST /auth/register` first).
6. Visit `https://chatgpt.com` and try submitting a prompt — a small
   panel in the bottom-right shows the inspection state.

## Permissions

- `storage` — session/profile persistence.
- `host_permissions` — a single origin, the API's (`http://localhost:5000/*`
  in `src/`; whatever `API_BASE_URL` a production build was run with in
  `dist/`). Lets the background service worker call the API without
  backend CORS changes (MV3 exempts host_permissions-covered origins from
  CORS for extension-page fetches). Never broader than that one origin.
- `content_scripts.matches` / `web_accessible_resources.matches` — scoped
  to `chatgpt.com` / `chat.openai.com` only, never `<all_urls>`.

No `externally_connectable` is declared, so only this extension's own
contexts (popup, content scripts) can message its background — an
arbitrary webpage cannot. `chrome.runtime.onMessage`'s handler
additionally checks `sender.id === chrome.runtime.id` as defense in
depth (see `service-worker.js`), and every message payload is
structurally validated (`submissionValidation.js`) before being acted
on — the background never trusts a content-script message's shape just
because it arrived on the internal channel.

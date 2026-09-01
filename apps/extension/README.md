# DataFlow Guardian — Browser Extension

Manifest V3 extension that acts as the enforcement point of DataFlow
Guardian: it inspects a user's prompt before submission to an external AI
site, sends it to the DataFlow Guardian API for a security decision, and
enforces the result. All security logic (policies, risk scoring,
decisions) lives in the backend — the extension never re-implements it.

## Status: Phase 1–3 complete

- **Phase 1** — MV3 skeleton, internal message passing.
- **Phase 2** — Login/logout against the real backend, session storage,
  session restoration, transparent access-token refresh.
- **Phase 3** — AI-website adapter architecture (ChatGPT only for now).

Still not implemented: prompt interception, sensitive-data detection,
redaction, blocking, or any policy/risk logic (Phase 4+).

## Structure

```
manifest.json
src/
  background/
    service-worker.js        Message router; owns extension + auth state
    auth/
      authService.js          login/logout/getSession/restoreSession
      apiClient.js              fetch wrapper: login, refresh, authenticatedRequest
      authStorage.js             chrome.storage.local, tokens vs. profile split
      jwt.js                       decode/expiry-check (reads claims, doesn't verify)
  content/
    content-script.js        Runs on chatgpt.com/chat.openai.com; resolves
                               an adapter and pings background with its
                               normalized destination metadata
    adapters/
      baseAdapter.js           AiWebsiteAdapter contract + defineAdapter() validator
      chatgptAdapter.js         ChatGPT implementation of the contract
      registry.js                resolveAdapter(url) -> adapter | null
      pageLifecycle.js            watches pushState/replaceState/popstate (SPA nav)
      destinationTypes.js         DESTINATION_TYPES, mirrors packages/shared
  popup/
    popup.html/.js/.css      Login form (logged-out) or user/org/role + logout (logged-in)
  shared/
    config.js                 API_BASE_URL
    messageTypes.js             chrome.runtime message type constants
    messaging.js                  sendToBackground() helper
    storage.js                     general (non-auth) extension state
```

## Adding a new AI-website adapter (e.g. Claude)

1. Create `src/content/adapters/claudeAdapter.js` implementing the
   `AiWebsiteAdapter` contract from `baseAdapter.js` (`defineAdapter({...})`).
2. Add it to the `ADAPTERS` array in `src/content/adapters/registry.js`.
3. Add its hostname(s) to `manifest.json`'s `content_scripts.matches` and
   `web_accessible_resources.matches`.

Nothing else changes — the content script, background, and popup only
ever talk to the adapter contract, never to a specific site's DOM.

## Build

```bash
npm run build --workspace=@dataflow-guardian/extension
```

Validates `manifest.json` and stages an unpacked copy into `dist/`. No
bundler is used — plain ES modules, loaded directly by Chrome.

## Test

```bash
npm run test --workspace=@dataflow-guardian/extension
```

Unit tests (Vitest) for the adapter contract, ChatGPT adapter matching,
registry resolution/fault isolation, destination normalization (cross-
checked against the real `@dataflow-guardian/shared` package), page
lifecycle (SPA navigation), and JWT claim decoding/expiry.

## Load into Chrome / Edge (developer mode)

1. Run the build (above), or point directly at `apps/extension/`.
2. Open `chrome://extensions`, enable **Developer mode**.
3. **Load unpacked** → select `apps/extension/dist` (or `apps/extension/`).
4. Make sure the backend is running at `http://localhost:5000` (see the
   root README) — the popup's login talks to it directly.
5. Click the toolbar icon: log in with an existing DataFlow Guardian
   account (register one via the web app or `POST /auth/register` first).

## Permissions

- `storage` — session/profile persistence.
- `host_permissions: ["http://localhost:5000/*"]` — lets the background
  service worker call the API without backend CORS changes (MV3 exempts
  host_permissions-covered origins from CORS for extension-page fetches).
  Production packaging (HTTPS API origin) is Phase 9 work.
- `content_scripts.matches` / `web_accessible_resources.matches` — scoped
  to `chatgpt.com` / `chat.openai.com` only, never `<all_urls>`.

No `externally_connectable` is declared, so only this extension's own
contexts (popup, content scripts) can message its background — an
arbitrary webpage cannot.

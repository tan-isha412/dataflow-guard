# DataFlow Guardian — Browser Extension

Manifest V3 extension that acts as the enforcement point of DataFlow
Guardian: it inspects a user's prompt before submission to an external AI
site, sends it to the DataFlow Guardian API for a security decision, and
enforces the result. All security logic (policies, risk scoring,
decisions) lives in the backend — the extension never re-implements it.

## Status: Phase 1

This phase only establishes the extension skeleton and internal message
passing. There is no authentication, no ChatGPT interception, and no
sensitive-data detection yet.

## Structure

```
manifest.json              MV3 manifest
src/
  background/
    service-worker.js      Background service worker (module), owns state
  content/
    content-script.js      Runs on chatgpt.com / chat.openai.com, pings background
  popup/
    popup.html/.js/.css    Toolbar popup UI
  shared/
    messageTypes.js         chrome.runtime message type constants
    messaging.js             sendToBackground() helper
    storage.js                chrome.storage.local wrapper
```

## Build

```bash
npm run build --workspace=@dataflow-guardian/extension
```

This validates `manifest.json` and stages an unpacked copy into `dist/`.
No bundler is used — the source is plain ES modules loaded directly by
Chrome, so `dist/` is just a validated, isolated copy of `src/` +
`manifest.json`.

## Load into Chrome / Edge (developer mode)

1. Run the build (above), or point directly at `apps/extension/` — both work
   since no transpilation happens.
2. Open `chrome://extensions`.
3. Enable **Developer mode** (top-right toggle).
4. Click **Load unpacked** and select `apps/extension/dist`
   (or `apps/extension/` if you skipped the build step).
5. The "DataFlow Guardian" extension should appear with no errors.
6. Click its toolbar icon to open the popup — it should show
   **Service worker: Active**.
7. Visit `https://chatgpt.com` — the content script pings the background
   worker on load; check the extension's service worker console
   (`chrome://extensions` → "service worker" link) for a connection log line.

## Permissions

Only `storage` is requested. There are no `host_permissions` — Phase 1
makes no network calls. `content_scripts.matches` is scoped to
`chatgpt.com` / `chat.openai.com` only (not `<all_urls>`).

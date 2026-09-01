/**
 * Content script entry point. Proves the messaging channel to the
 * background service worker works, and (Phase 3) resolves which AI
 * website adapter, if any, owns this page. It does not read page
 * content, does not touch the DOM, and does not intercept prompts —
 * that is Phase 4 work. adapter.locatePromptInput()/onSubmitAttempt()/
 * setPromptText() exist in the contract but are stubs until then.
 *
 * Declarative content scripts run as classic (non-module) scripts, so
 * the ../shared/messageTypes.js constants can't be imported here the
 * normal way; the two literal strings below are duplicated from that
 * file and must stay in sync with it. The adapter modules, by contrast,
 * ARE real ES modules — reached via dynamic import() of an extension URL,
 * which classic content scripts can do without needing to be declared
 * "type": "module" themselves.
 */
(function () {
  const CONTENT_SCRIPT_PING = "CONTENT_SCRIPT_PING";
  const CONTENT_SCRIPT_PING_ACK = "CONTENT_SCRIPT_PING_ACK";

  function pingBackground(destination) {
    chrome.runtime
      .sendMessage({ type: CONTENT_SCRIPT_PING, payload: { loadedAt: Date.now(), destination } })
      .then((response) => {
        if (response?.type === CONTENT_SCRIPT_PING_ACK) {
          console.debug("[DataFlow Guardian] connected to background service worker");
        }
      })
      .catch((error) => {
        console.debug("[DataFlow Guardian] could not reach background service worker", error);
      });
  }

  async function bootstrapAdapters() {
    try {
      const { resolveAdapter } = await import(chrome.runtime.getURL("src/content/adapters/registry.js"));
      const { watchPageLifecycle } = await import(chrome.runtime.getURL("src/content/adapters/pageLifecycle.js"));

      function resolveAndReport() {
        const adapter = resolveAdapter(new URL(window.location.href));
        if (adapter) {
          console.debug(`[DataFlow Guardian] adapter matched: ${adapter.id}`);
          pingBackground(adapter.getDestination());
        } else {
          console.debug("[DataFlow Guardian] no adapter matched this page");
        }
      }

      resolveAndReport();
      // ChatGPT navigates between conversations via pushState — re-resolve
      // on every route change instead of relying on a fresh injection.
      watchPageLifecycle(resolveAndReport);
    } catch (error) {
      console.error("[DataFlow Guardian] adapter bootstrap failed", error);
      pingBackground(null);
    }
  }

  bootstrapAdapters();
})();

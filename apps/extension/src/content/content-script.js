/**
 * Content script entry point.
 *  - Phase 1: proves the messaging channel to the background service
 *    worker works.
 *  - Phase 3: resolves which AI website adapter, if any, owns this page,
 *    and reports its normalized destination to the background.
 *  - Phase 4/5: once an adapter is resolved, starts the prompt
 *    interceptor, which turns the adapter's submit hook into inspection
 *    requests and enforces the resulting decision. See
 *    interception/promptInterceptor.js for the actual pipeline — this
 *    file only wires it up.
 *
 * Declarative content scripts run as classic (non-module) scripts, so
 * the ../shared/messageTypes.js constants can't be imported here the
 * normal way; the two literal strings below are duplicated from that
 * file and must stay in sync with it. Everything else in src/content/ IS
 * real ES modules — reached via dynamic import() of an extension URL,
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
      const { createPromptInterceptor } = await import(
        chrome.runtime.getURL("src/content/interception/promptInterceptor.js")
      );

      // Started once, for the first adapter this content script sees.
      // The interceptor listens at the document level (capture phase),
      // so it keeps working across SPA navigation within the same
      // adapter without needing to be re-created on every route change —
      // see chatgptAdapter.js's onSubmitAttempt for why that's safe.
      let interceptorStarted = false;

      function resolveAndReport() {
        const adapter = resolveAdapter(new URL(window.location.href));
        if (adapter) {
          console.debug(`[DataFlow Guardian] adapter matched: ${adapter.id}`);
          pingBackground(adapter.getDestination());

          if (!interceptorStarted) {
            createPromptInterceptor(adapter);
            interceptorStarted = true;
          }
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

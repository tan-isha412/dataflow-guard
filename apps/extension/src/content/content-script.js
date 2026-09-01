/**
 * Minimal content script for Phase 1: proves the messaging channel to the
 * background service worker works. It does not read page content, does not
 * touch the DOM, and does not intercept anything — that is Phase 3/4 work.
 *
 * Message type strings are duplicated from ../shared/messageTypes.js
 * (declarative content scripts cannot import ES modules) and must stay in
 * sync with that file.
 */
(function () {
  const CONTENT_SCRIPT_PING = "CONTENT_SCRIPT_PING";
  const CONTENT_SCRIPT_PING_ACK = "CONTENT_SCRIPT_PING_ACK";

  chrome.runtime
    .sendMessage({ type: CONTENT_SCRIPT_PING, payload: { loadedAt: Date.now() } })
    .then((response) => {
      if (response?.type === CONTENT_SCRIPT_PING_ACK) {
        console.debug("[DataFlow Guardian] connected to background service worker");
      }
    })
    .catch((error) => {
      console.debug("[DataFlow Guardian] could not reach background service worker", error);
    });
})();

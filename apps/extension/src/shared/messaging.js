/**
 * Sends a message to the background service worker and returns its
 * response. Callable from any extension page context (popup, options)
 * that has access to the chrome.runtime API.
 */
export async function sendToBackground(message) {
  return chrome.runtime.sendMessage(message);
}

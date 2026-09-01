import { chatgptAdapter } from "./chatgptAdapter.js";

/**
 * All registered adapters. Adding Claude/Gemini later means adding one
 * import + one array entry here — nothing else in the extension (content
 * script bootstrapping, background, popup) needs to change, because
 * everything downstream only ever talks to the AiWebsiteAdapter contract
 * from baseAdapter.js, never to a specific site's DOM.
 */
const ADAPTERS = [chatgptAdapter];

/**
 * Finds the adapter (if any) that owns the given page. A single
 * misbehaving adapter (e.g. matches() throws) is isolated and logged —
 * it does not stop other adapters from being tried, and never crashes
 * the content script.
 * @param {URL} url
 * @returns {import("./baseAdapter.js").AiWebsiteAdapter | null}
 */
export function resolveAdapter(url) {
  for (const adapter of ADAPTERS) {
    try {
      if (adapter.matches(url)) {
        return adapter;
      }
    } catch (error) {
      console.error(`[DataFlow Guardian] adapter "${adapter.id}" threw during matches()`, error);
    }
  }
  return null;
}

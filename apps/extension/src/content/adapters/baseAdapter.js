/**
 * The contract every AI-website adapter must satisfy. This is what lets
 * the rest of the extension (and, eventually, the inspection pipeline)
 * ask questions about "the current page" without knowing anything about
 * a specific site's DOM — see registry.js for how adapters are selected.
 *
 * An adapter must NOT contain policy, risk, detection, or authorization
 * logic. It only answers questions about browser/page structure.
 *
 * @typedef {Object} DestinationMetadata
 * @property {string} destinationId   stable id, e.g. "chatgpt"
 * @property {string} provider        e.g. "OpenAI"
 * @property {string} destinationType one of destinationTypes.js DESTINATION_TYPES
 * @property {string} displayName     e.g. "ChatGPT"
 *
 * @typedef {Object} AiWebsiteAdapter
 * @property {string} id                                      unique adapter id
 * @property {(url: URL) => boolean} matches                   does this adapter own the given page?
 * @property {() => DestinationMetadata} getDestination         normalized destination info
 * @property {(url: URL) => boolean} isChatPage                 is this a chat/prompt page vs. marketing/login?
 * @property {() => (Element|null)} locatePromptInput           Phase 4 hook — not implemented yet
 * @property {(cb: Function) => (() => void)} onSubmitAttempt    Phase 4 hook — not implemented yet
 * @property {(text: string) => boolean} setPromptText           Phase 4 hook — not implemented yet
 */

const REQUIRED_METHODS = ["matches", "getDestination", "isChatPage", "locatePromptInput", "onSubmitAttempt", "setPromptText"];

/**
 * Validates an adapter's shape at definition time so a malformed adapter
 * fails loudly when the module loads, not silently later when the
 * registry tries to call a missing method.
 * @param {Object} config
 * @returns {AiWebsiteAdapter}
 */
export function defineAdapter(config) {
  if (!config?.id || typeof config.id !== "string") {
    throw new Error("Adapter must have a string id");
  }
  for (const method of REQUIRED_METHODS) {
    if (typeof config[method] !== "function") {
      throw new Error(`Adapter "${config.id}" is missing required method "${method}"`);
    }
  }
  return Object.freeze({ ...config });
}

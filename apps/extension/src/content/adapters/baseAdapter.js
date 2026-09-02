/**
 * The contract every AI-website adapter must satisfy. This is what lets
 * the rest of the extension (and the inspection pipeline) ask questions
 * about "the current page" without knowing anything about a specific
 * site's DOM — see registry.js for how adapters are selected.
 *
 * An adapter must NOT contain policy, risk, detection, or authorization
 * logic. It only answers questions about browser/page structure and
 * performs the mechanical act of reading/writing/submitting the prompt
 * box — never decides whether a prompt is safe to send.
 *
 * @typedef {Object} DestinationMetadata
 * @property {string} destinationId   stable id, e.g. "chatgpt"
 * @property {string} provider        e.g. "OpenAI"
 * @property {string} destinationType one of destinationTypes.js DESTINATION_TYPES
 * @property {string} displayName     e.g. "ChatGPT"
 *
 * @typedef {Object} AiWebsiteAdapter
 * @property {string} id                                       unique adapter id
 * @property {(url: URL) => boolean} matches                    does this adapter own the given page?
 * @property {() => DestinationMetadata} getDestination          normalized destination info
 * @property {(url: URL) => boolean} isChatPage                  is this a chat/prompt page vs. marketing/login?
 * @property {() => (Element|null)} locatePromptInput            finds the current prompt input, freshly queried every call (never a cached reference) so it stays correct across re-renders
 * @property {() => string} getCurrentPromptText                 the prompt input's current text ("" if not found) — lets the pipeline layer read live content (e.g. to detect the user edited it while inspection was in flight) without knowing whether the input is a <textarea> or contenteditable
 * @property {(cb: (content: string) => void) => (() => void)} onSubmitAttempt
 *     Calls `cb(content)` exactly once per genuine user-initiated submission
 *     attempt (click or Enter), having already prevented the browser's
 *     default action so nothing reaches the site before a decision is
 *     made. Does NOT fire for an extension-approved re-submission
 *     triggered via submitApproved() — that's the loop-prevention
 *     boundary. Returns an unsubscribe function.
 * @property {(text: string) => boolean} setPromptText            overwrites the prompt input's content; returns false if the input can't be found
 * @property {(finalContent: string) => boolean} submitApproved    re-triggers the real submission with finalContent (writing it first if it differs from what's currently in the input), marked internally so onSubmitAttempt does not re-intercept it. Returns false if it could not complete.
 */

const REQUIRED_METHODS = [
  "matches",
  "getDestination",
  "isChatPage",
  "locatePromptInput",
  "getCurrentPromptText",
  "onSubmitAttempt",
  "setPromptText",
  "submitApproved"
];

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

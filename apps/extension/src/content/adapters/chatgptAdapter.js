import { defineAdapter } from "./baseAdapter.js";
import { DESTINATION_TYPES } from "./destinationTypes.js";

const CHATGPT_HOSTNAMES = new Set(["chatgpt.com", "chat.openai.com"]);

export const chatgptAdapter = defineAdapter({
  id: "chatgpt",

  matches(url) {
    return CHATGPT_HOSTNAMES.has(url.hostname);
  },

  getDestination() {
    return {
      destinationId: "chatgpt",
      provider: "OpenAI",
      destinationType: DESTINATION_TYPES.EXTERNAL_AI,
      displayName: "ChatGPT"
    };
  },

  // ChatGPT's marketing/pricing/login pages share its hostname with the
  // actual chat UI — only "/" and "/c/<conversation-id>" are chat pages.
  isChatPage(url) {
    return url.pathname === "/" || url.pathname.startsWith("/c/");
  },

  // --- Phase 4 hooks: intentionally not implemented yet. ---
  locatePromptInput() {
    return null;
  },
  onSubmitAttempt() {
    return () => {}; // unsubscribe no-op
  },
  setPromptText() {
    return false;
  }
});

import { defineAdapter } from "./baseAdapter.js";
import { DESTINATION_TYPES } from "./destinationTypes.js";

const CHATGPT_HOSTNAMES = new Set(["chatgpt.com", "chat.openai.com"]);

/**
 * Best-effort selectors for ChatGPT's prompt composer and send button.
 * IMPORTANT / HONEST LIMITATION: these were not verified against the
 * live chatgpt.com DOM — this development environment has no network
 * route to the real site (see the Phase 4/5 report). Multiple
 * candidates are tried in priority order, ending in a generic fallback
 * (any contenteditable/textarea inside a <form>), so a selector going
 * stale as ChatGPT changes its markup degrades gracefully instead of
 * breaking outright. What IS verified in a real browser is everything
 * downstream of "an element was found": text extraction, text
 * replacement, submit interception/dedup, and the message pipeline —
 * exercised against a synthetic page built to the same DOM shape (see
 * tests/playwright/prompt-interception.spec, run in real Chromium).
 */
const PROMPT_INPUT_SELECTORS = [
  "#prompt-textarea",
  'form [contenteditable="true"]',
  "form textarea"
];

const SUBMIT_BUTTON_SELECTORS = [
  '[data-testid="send-button"]',
  'button[aria-label*="Send" i]',
  'form button[type="submit"]'
];

function queryFirst(documentRef, selectors) {
  for (const selector of selectors) {
    const el = documentRef.querySelector(selector);
    if (el) return el;
  }
  return null;
}

function extractText(el) {
  if (!el) return "";
  if (el.tagName === "TEXTAREA") return el.value;
  return el.innerText ?? el.textContent ?? "";
}

/**
 * Writes text into a textarea or a contenteditable div in a way that
 * gives a React-controlled input a real chance of noticing the change
 * (a plain `.value =` / `.textContent =` assignment is frequently
 * ignored by React because it bypasses the tracked native setter).
 * Falls back to the plain assignment if the tracked setter isn't
 * available. Unverified against ChatGPT's actual React internals — see
 * the file-level limitation note above.
 */
function writeText(el, text, windowRef) {
  if (el.tagName === "TEXTAREA") {
    const nativeSetter = Object.getOwnPropertyDescriptor(windowRef.HTMLTextAreaElement.prototype, "value")?.set;
    if (nativeSetter) {
      nativeSetter.call(el, text);
    } else {
      el.value = text;
    }
    el.dispatchEvent(new windowRef.Event("input", { bubbles: true }));
    return;
  }

  el.textContent = text;
  el.dispatchEvent(new windowRef.Event("input", { bubbles: true }));
}

/**
 * Builds a ChatGPT adapter instance. Accepts documentRef/windowRef so
 * tests can inject fakes instead of requiring a real DOM (jsdom) — the
 * production adapter (chatgptAdapter, exported below) just calls this
 * with the real document/window.
 */
export function createChatgptAdapter(documentRef = globalThis.document, windowRef = globalThis.window) {
  // Module... well, factory-scoped state: true while the extension
  // itself is in the middle of re-submitting an approved/redacted
  // prompt, so the same click/Enter that WE trigger isn't intercepted
  // as a second "user" attempt (the loop-prevention boundary).
  let approvedSubmissionInFlight = false;

  function locatePromptInput() {
    return queryFirst(documentRef, PROMPT_INPUT_SELECTORS);
  }

  function locateSubmitButton() {
    return queryFirst(documentRef, SUBMIT_BUTTON_SELECTORS);
  }

  function getCurrentPromptText() {
    return extractText(locatePromptInput()).trim();
  }

  function setPromptText(text) {
    const input = locatePromptInput();
    if (!input) return false;
    writeText(input, text, windowRef);
    return true;
  }

  function submitApproved(finalContent) {
    const input = locatePromptInput();
    const button = locateSubmitButton();
    if (!input || !button) return false;

    if (extractText(input).trim() !== finalContent.trim()) {
      writeText(input, finalContent, windowRef);
    }

    approvedSubmissionInFlight = true;
    button.click();
    // The click is dispatched and handled synchronously by our own
    // capture-phase listener (see onSubmitAttempt below) before this
    // line resumes, so it's safe to clear the flag right after.
    approvedSubmissionInFlight = false;
    return true;
  }

  function onSubmitAttempt(callback) {
    function isComposing(event) {
      return event.isComposing === true;
    }

    function handleAttempt(event) {
      if (approvedSubmissionInFlight) {
        return; // our own re-submission — let it through untouched
      }

      const content = getCurrentPromptText();
      if (!content) {
        return; // nothing to inspect; let the site's own empty-input handling run
      }

      // Stop the site from ever seeing this attempt until a decision
      // comes back — the central security property of Phase 5.
      event.preventDefault();
      event.stopImmediatePropagation();
      callback(content);
    }

    function handleClick(event) {
      const button = locateSubmitButton();
      if (button && (event.target === button || button.contains(event.target))) {
        handleAttempt(event);
      }
    }

    function handleKeydown(event) {
      if (event.key !== "Enter" || event.shiftKey || isComposing(event)) {
        return;
      }
      const input = locatePromptInput();
      if (input && (event.target === input || input.contains(event.target))) {
        handleAttempt(event);
      }
    }

    // Listening on `document` in the CAPTURE phase — rather than on the
    // input/button elements directly — means this keeps working even
    // when ChatGPT's React tree unmounts and re-mounts those elements
    // (a fresh querySelector happens on every event, never a stale
    // cached reference), and it runs before the site's own bubble-phase
    // handlers, which is what makes preventDefault()/
    // stopImmediatePropagation() actually effective.
    documentRef.addEventListener("click", handleClick, true);
    documentRef.addEventListener("keydown", handleKeydown, true);

    return function unsubscribe() {
      documentRef.removeEventListener("click", handleClick, true);
      documentRef.removeEventListener("keydown", handleKeydown, true);
    };
  }

  return defineAdapter({
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

    isChatPage(url) {
      return url.pathname === "/" || url.pathname.startsWith("/c/");
    },

    locatePromptInput,
    getCurrentPromptText,
    onSubmitAttempt,
    setPromptText,
    submitApproved
  });
}

export const chatgptAdapter = createChatgptAdapter();

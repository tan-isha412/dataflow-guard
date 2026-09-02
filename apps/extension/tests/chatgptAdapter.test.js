import { describe, it, expect, vi } from "vitest";
import { Window } from "happy-dom";
import { chatgptAdapter, createChatgptAdapter } from "../src/content/adapters/chatgptAdapter.js";

describe("chatgptAdapter.matches", () => {
  it("matches chatgpt.com", () => {
    expect(chatgptAdapter.matches(new URL("https://chatgpt.com/"))).toBe(true);
  });

  it("matches the legacy chat.openai.com host", () => {
    expect(chatgptAdapter.matches(new URL("https://chat.openai.com/c/abc123"))).toBe(true);
  });

  it("does not match an unrelated host", () => {
    expect(chatgptAdapter.matches(new URL("https://claude.ai/"))).toBe(false);
  });

  it("does not match a host that merely contains chatgpt.com as a substring", () => {
    expect(chatgptAdapter.matches(new URL("https://chatgpt.com.evil.example/"))).toBe(false);
  });
});

describe("chatgptAdapter.isChatPage", () => {
  it("treats the root path as a chat page", () => {
    expect(chatgptAdapter.isChatPage(new URL("https://chatgpt.com/"))).toBe(true);
  });

  it("treats /c/<id> as a chat page", () => {
    expect(chatgptAdapter.isChatPage(new URL("https://chatgpt.com/c/abc123"))).toBe(true);
  });

  it("does not treat a marketing page as a chat page", () => {
    expect(chatgptAdapter.isChatPage(new URL("https://chatgpt.com/pricing"))).toBe(false);
  });
});

/**
 * Real DOM interaction tests, using happy-dom (not a hand-rolled fake)
 * so querySelector/dispatchEvent behave like an actual browser. Built
 * against a synthetic page shaped like ChatGPT's composer — NOT the
 * live chatgpt.com DOM, which this environment cannot reach (see the
 * Phase 4/5 report's honesty note on that limitation).
 */
function buildChatgptLikePage({ contenteditable = true } = {}) {
  const window = new Window({ url: "https://chatgpt.com/" });
  const document = window.document;
  document.body.innerHTML = contenteditable
    ? `<form>
         <div id="prompt-textarea" contenteditable="true"></div>
         <button data-testid="send-button" type="button">Send</button>
       </form>`
    : `<form>
         <textarea></textarea>
         <button data-testid="send-button" type="button">Send</button>
       </form>`;
  return { window, document };
}

describe("chatgptAdapter DOM interaction (contenteditable composer)", () => {
  it("locatePromptInput finds the contenteditable composer", () => {
    const { document, window } = buildChatgptLikePage();
    const adapter = createChatgptAdapter(document, window);
    expect(adapter.locatePromptInput().id).toBe("prompt-textarea");
  });

  it("getCurrentPromptText reads the composer's text", () => {
    const { document, window } = buildChatgptLikePage();
    document.getElementById("prompt-textarea").textContent = "hello world";
    const adapter = createChatgptAdapter(document, window);
    expect(adapter.getCurrentPromptText()).toBe("hello world");
  });

  it("setPromptText writes into the composer and fires an input event", () => {
    const { document, window } = buildChatgptLikePage();
    const adapter = createChatgptAdapter(document, window);
    const input = document.getElementById("prompt-textarea");
    const inputListener = vi.fn();
    input.addEventListener("input", inputListener);

    expect(adapter.setPromptText("redacted content")).toBe(true);
    expect(input.textContent).toBe("redacted content");
    expect(inputListener).toHaveBeenCalledTimes(1);
  });

  it("returns false from setPromptText when no composer exists", () => {
    const window = new Window({ url: "https://chatgpt.com/pricing" });
    const document = window.document;
    document.body.innerHTML = "<div>Pricing page, no composer here</div>";
    const adapter = createChatgptAdapter(document, window);
    expect(adapter.setPromptText("x")).toBe(false);
  });
});

describe("chatgptAdapter DOM interaction (textarea composer)", () => {
  it("locatePromptInput falls back to a plain textarea", () => {
    const { document, window } = buildChatgptLikePage({ contenteditable: false });
    const adapter = createChatgptAdapter(document, window);
    expect(adapter.locatePromptInput().tagName).toBe("TEXTAREA");
  });

  it("getCurrentPromptText reads a textarea's value", () => {
    const { document, window } = buildChatgptLikePage({ contenteditable: false });
    document.querySelector("textarea").value = "safe prompt";
    const adapter = createChatgptAdapter(document, window);
    expect(adapter.getCurrentPromptText()).toBe("safe prompt");
  });
});

describe("chatgptAdapter.onSubmitAttempt — submission interception", () => {
  it("intercepts a button click with non-empty content: prevents default and calls back with the text", () => {
    const { document, window } = buildChatgptLikePage();
    const adapter = createChatgptAdapter(document, window);
    document.getElementById("prompt-textarea").textContent = "explain recursion";

    const callback = vi.fn();
    adapter.onSubmitAttempt(callback);

    const button = document.querySelector('[data-testid="send-button"]');
    const event = new window.MouseEvent("click", { bubbles: true, cancelable: true });
    button.dispatchEvent(event);

    expect(callback).toHaveBeenCalledWith("explain recursion");
    expect(event.defaultPrevented).toBe(true);
  });

  it("intercepts Enter (no Shift) on the composer", () => {
    const { document, window } = buildChatgptLikePage();
    const adapter = createChatgptAdapter(document, window);
    const input = document.getElementById("prompt-textarea");
    input.textContent = "hello";

    const callback = vi.fn();
    adapter.onSubmitAttempt(callback);

    const event = new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    input.dispatchEvent(event);

    expect(callback).toHaveBeenCalledWith("hello");
    expect(event.defaultPrevented).toBe(true);
  });

  it("does NOT intercept Shift+Enter (newline, not submit)", () => {
    const { document, window } = buildChatgptLikePage();
    const adapter = createChatgptAdapter(document, window);
    const input = document.getElementById("prompt-textarea");
    input.textContent = "line one";

    const callback = vi.fn();
    adapter.onSubmitAttempt(callback);

    const event = new window.KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true, cancelable: true });
    input.dispatchEvent(event);

    expect(callback).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("does NOT intercept an empty submission (nothing to inspect)", () => {
    const { document, window } = buildChatgptLikePage();
    const adapter = createChatgptAdapter(document, window);
    // composer left empty

    const callback = vi.fn();
    adapter.onSubmitAttempt(callback);

    const button = document.querySelector('[data-testid="send-button"]');
    const event = new window.MouseEvent("click", { bubbles: true, cancelable: true });
    button.dispatchEvent(event);

    expect(callback).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("does NOT intercept a click on an unrelated element", () => {
    const { document, window } = buildChatgptLikePage();
    document.body.innerHTML += "<button id='unrelated'>Unrelated</button>";
    const adapter = createChatgptAdapter(document, window);
    document.getElementById("prompt-textarea").textContent = "hi";

    const callback = vi.fn();
    adapter.onSubmitAttempt(callback);

    document.getElementById("unrelated").dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    expect(callback).not.toHaveBeenCalled();
  });

  it("unsubscribe stops future interception", () => {
    const { document, window } = buildChatgptLikePage();
    const adapter = createChatgptAdapter(document, window);
    document.getElementById("prompt-textarea").textContent = "hello";

    const callback = vi.fn();
    const unsubscribe = adapter.onSubmitAttempt(callback);
    unsubscribe();

    const button = document.querySelector('[data-testid="send-button"]');
    button.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(callback).not.toHaveBeenCalled();
  });
});

describe("chatgptAdapter.submitApproved — loop prevention", () => {
  it("re-triggers the real submission without re-invoking onSubmitAttempt's callback", () => {
    const { document, window } = buildChatgptLikePage();
    const adapter = createChatgptAdapter(document, window);
    document.getElementById("prompt-textarea").textContent = "original";

    const callback = vi.fn();
    adapter.onSubmitAttempt(callback);

    const clickSpy = vi.fn();
    document.querySelector('[data-testid="send-button"]').addEventListener("click", clickSpy);

    expect(adapter.submitApproved("original")).toBe(true);
    expect(clickSpy).toHaveBeenCalledTimes(1); // the real click did happen
    expect(callback).not.toHaveBeenCalled(); // but it was not treated as a new user attempt
  });

  it("writes the final (e.g. redacted) content before submitting when it differs from what's in the box", () => {
    const { document, window } = buildChatgptLikePage();
    const adapter = createChatgptAdapter(document, window);
    document.getElementById("prompt-textarea").textContent = "my email is a@b.com";

    adapter.submitApproved("my email is [EMAIL_REDACTED]");

    expect(document.getElementById("prompt-textarea").textContent).toBe("my email is [EMAIL_REDACTED]");
  });

  it("returns false when the composer or button can't be found", () => {
    const window = new Window({ url: "https://chatgpt.com/pricing" });
    const document = window.document;
    document.body.innerHTML = "<div>no composer</div>";
    const adapter = createChatgptAdapter(document, window);
    expect(adapter.submitApproved("x")).toBe(false);
  });

  it("a genuine user attempt right after an approved submission is still intercepted normally", () => {
    const { document, window } = buildChatgptLikePage();
    const adapter = createChatgptAdapter(document, window);
    const input = document.getElementById("prompt-textarea");
    input.textContent = "first prompt";

    const callback = vi.fn();
    adapter.onSubmitAttempt(callback);
    adapter.submitApproved("first prompt");
    expect(callback).not.toHaveBeenCalled();

    // user types a second prompt and submits for real
    input.textContent = "second prompt";
    const button = document.querySelector('[data-testid="send-button"]');
    button.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith("second prompt");
  });
});

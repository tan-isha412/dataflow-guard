import { describe, it, expect } from "vitest";
import { chatgptAdapter } from "../src/content/adapters/chatgptAdapter.js";

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

describe("chatgptAdapter Phase 4 hooks (not implemented yet)", () => {
  it("locatePromptInput returns null", () => {
    expect(chatgptAdapter.locatePromptInput()).toBeNull();
  });

  it("setPromptText returns false", () => {
    expect(chatgptAdapter.setPromptText("hello")).toBe(false);
  });

  it("onSubmitAttempt returns an unsubscribe function that is safe to call", () => {
    const unsubscribe = chatgptAdapter.onSubmitAttempt(() => {});
    expect(typeof unsubscribe).toBe("function");
    expect(() => unsubscribe()).not.toThrow();
  });
});

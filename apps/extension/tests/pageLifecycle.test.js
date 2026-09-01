import { describe, it, expect, vi } from "vitest";
import { watchPageLifecycle } from "../src/content/adapters/pageLifecycle.js";

// A minimal fake of the subset of `window` this module touches, so the
// lifecycle logic is verified without pulling in jsdom as a dependency.
function createFakeWindow(initialUrl) {
  let currentUrl = initialUrl;
  const listeners = {};
  return {
    URL,
    location: {
      get href() {
        return currentUrl;
      }
    },
    history: {
      pushState(_state, _title, url) {
        if (url) currentUrl = new URL(url, currentUrl).href;
      },
      replaceState(_state, _title, url) {
        if (url) currentUrl = new URL(url, currentUrl).href;
      }
    },
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    removeEventListener(type, handler) {
      if (listeners[type] === handler) delete listeners[type];
    },
    _fireEvent(type) {
      listeners[type]?.();
    },
    _setUrl(url) {
      currentUrl = url;
    }
  };
}

describe("watchPageLifecycle", () => {
  it("calls onNavigate with the new URL after pushState", () => {
    const fakeWindow = createFakeWindow("https://chatgpt.com/");
    const onNavigate = vi.fn();
    watchPageLifecycle(onNavigate, fakeWindow);

    fakeWindow.history.pushState({}, "", "https://chatgpt.com/c/abc123");

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate.mock.calls[0][0].pathname).toBe("/c/abc123");
  });

  it("calls onNavigate after replaceState", () => {
    const fakeWindow = createFakeWindow("https://chatgpt.com/");
    const onNavigate = vi.fn();
    watchPageLifecycle(onNavigate, fakeWindow);

    fakeWindow.history.replaceState({}, "", "https://chatgpt.com/c/def456");

    expect(onNavigate).toHaveBeenCalledTimes(1);
  });

  it("calls onNavigate on a popstate event (back/forward navigation)", () => {
    const fakeWindow = createFakeWindow("https://chatgpt.com/c/abc123");
    const onNavigate = vi.fn();
    watchPageLifecycle(onNavigate, fakeWindow);

    fakeWindow._setUrl("https://chatgpt.com/");
    fakeWindow._fireEvent("popstate");

    expect(onNavigate).toHaveBeenCalledTimes(1);
    expect(onNavigate.mock.calls[0][0].pathname).toBe("/");
  });

  it("does not crash the page when the callback itself throws", () => {
    const fakeWindow = createFakeWindow("https://chatgpt.com/");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    watchPageLifecycle(() => {
      throw new Error("adapter blew up");
    }, fakeWindow);

    expect(() => fakeWindow.history.pushState({}, "", "https://chatgpt.com/c/x")).not.toThrow();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("stopWatching stops intercepting pushState and removes the popstate listener", () => {
    const fakeWindow = createFakeWindow("https://chatgpt.com/");
    const onNavigate = vi.fn();

    const stopWatching = watchPageLifecycle(onNavigate, fakeWindow);
    stopWatching();

    fakeWindow.history.pushState({}, "", "https://chatgpt.com/c/after-stop");
    fakeWindow._fireEvent("popstate");

    expect(onNavigate).not.toHaveBeenCalled();
  });
});

/**
 * ChatGPT (and AI sites generally) are SPAs: navigating between
 * conversations doesn't reload the page, so a content script only gets
 * ONE injection per full page load. This watches history.pushState /
 * replaceState / popstate — the mechanisms SPA routers use — and calls
 * back on every route change, so whatever depends on "which page am I
 * on" (adapter resolution today; the prompt-input observer in Phase 4)
 * can re-run without a fresh injection.
 *
 * `windowRef` defaults to the real `window` but can be swapped for a
 * fake in tests, so this logic is verifiable without jsdom.
 */
export function watchPageLifecycle(onNavigate, windowRef = window) {
  const { history } = windowRef;
  const originalPushState = history.pushState.bind(history);
  const originalReplaceState = history.replaceState.bind(history);

  function notify() {
    try {
      onNavigate(new windowRef.URL(windowRef.location.href));
    } catch (error) {
      console.error("[DataFlow Guardian] page lifecycle callback failed", error);
    }
  }

  history.pushState = (...args) => {
    originalPushState(...args);
    notify();
  };
  history.replaceState = (...args) => {
    originalReplaceState(...args);
    notify();
  };
  windowRef.addEventListener("popstate", notify);

  return function stopWatching() {
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
    windowRef.removeEventListener("popstate", notify);
  };
}

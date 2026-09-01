import { MESSAGE_TYPES } from "../shared/messageTypes.js";
import { initializeExtensionState, getExtensionState, patchExtensionState } from "../shared/storage.js";
import * as authService from "./auth/authService.js";
import { ApiError } from "./auth/apiClient.js";

chrome.runtime.onInstalled.addListener(async (details) => {
  await initializeExtensionState();
  await authService.restoreSession();
  console.log(`[DataFlow Guardian] installed (reason: ${details.reason})`);
});

// onInstalled does NOT fire on a plain browser restart — onStartup is
// what covers "reopen the browser and authentication state is handled
// correctly" from the Phase 2 acceptance criteria.
chrome.runtime.onStartup.addListener(async () => {
  await authService.restoreSession();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Defense in depth: without an `externally_connectable` manifest entry,
  // Chrome already restricts chrome.runtime.onMessage to senders that are
  // part of this extension (popup, content scripts, other extension
  // pages) — an arbitrary webpage cannot reach this listener at all. This
  // check makes that assumption explicit rather than implicit.
  if (sender.id !== chrome.runtime.id) {
    return false;
  }

  handleMessage(message, sender)
    .then(sendResponse)
    .catch((error) => sendResponse({ type: MESSAGE_TYPES.ERROR, payload: { message: error.message } }));
  return true; // keep the message channel open for the async response
});

async function handleMessage(message, sender) {
  switch (message?.type) {
    case MESSAGE_TYPES.GET_STATUS: {
      const state = await getExtensionState();
      return {
        type: MESSAGE_TYPES.STATUS_RESPONSE,
        payload: { ...state, version: chrome.runtime.getManifest().version }
      };
    }

    case MESSAGE_TYPES.CONTENT_SCRIPT_PING: {
      await patchExtensionState({
        lastContentScriptPing: {
          url: sender.tab?.url ?? null,
          at: Date.now(),
          destination: message.payload?.destination ?? null
        }
      });
      return { type: MESSAGE_TYPES.CONTENT_SCRIPT_PING_ACK, payload: { received: true } };
    }

    case MESSAGE_TYPES.AUTH_LOGIN: {
      try {
        const session = await authService.login(message.payload ?? {});
        return { type: MESSAGE_TYPES.AUTH_LOGIN_RESULT, payload: { success: true, session } };
      } catch (error) {
        return {
          type: MESSAGE_TYPES.AUTH_LOGIN_RESULT,
          payload: { success: false, error: toSafeError(error) }
        };
      }
    }

    case MESSAGE_TYPES.AUTH_LOGOUT: {
      await authService.logout();
      return { type: MESSAGE_TYPES.AUTH_LOGOUT_RESULT, payload: { success: true } };
    }

    case MESSAGE_TYPES.AUTH_GET_SESSION: {
      const session = await authService.getSession();
      return { type: MESSAGE_TYPES.AUTH_SESSION_RESPONSE, payload: session };
    }

    default:
      return { type: MESSAGE_TYPES.ERROR, payload: { message: `Unknown message type: ${message?.type}` } };
  }
}

// Never forward a raw Error/stack to the popup — only a message safe to
// display and a machine-readable code the UI can branch on.
function toSafeError(error) {
  if (error instanceof ApiError) {
    return { code: error.code, message: error.message };
  }
  return { code: "UNKNOWN_ERROR", message: "Something went wrong" };
}

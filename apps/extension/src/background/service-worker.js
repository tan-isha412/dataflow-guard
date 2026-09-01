import { MESSAGE_TYPES } from "../shared/messageTypes.js";
import { initializeExtensionState, getExtensionState, patchExtensionState } from "../shared/storage.js";

chrome.runtime.onInstalled.addListener(async (details) => {
  await initializeExtensionState();
  console.log(`[DataFlow Guardian] installed (reason: ${details.reason})`);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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
        lastContentScriptPing: { url: sender.tab?.url ?? null, at: Date.now() }
      });
      return { type: MESSAGE_TYPES.CONTENT_SCRIPT_PING_ACK, payload: { received: true } };
    }

    default:
      return { type: MESSAGE_TYPES.ERROR, payload: { message: `Unknown message type: ${message?.type}` } };
  }
}

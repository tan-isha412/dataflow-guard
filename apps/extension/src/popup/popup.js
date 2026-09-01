import { MESSAGE_TYPES } from "../shared/messageTypes.js";
import { sendToBackground } from "../shared/messaging.js";

async function loadStatus() {
  const statusEl = document.getElementById("status");
  const detailEl = document.getElementById("detail");
  const versionEl = document.getElementById("version");

  try {
    const response = await sendToBackground({ type: MESSAGE_TYPES.GET_STATUS });
    if (response?.type !== MESSAGE_TYPES.STATUS_RESPONSE) {
      throw new Error("Unexpected response from background service worker");
    }

    const { lastContentScriptPing, version } = response.payload;

    versionEl.textContent = `v${version}`;
    statusEl.textContent = "Active";
    statusEl.classList.add("status-ok");

    detailEl.textContent = lastContentScriptPing
      ? `Last seen ${new Date(lastContentScriptPing.at).toLocaleTimeString()}`
      : "No AI site activity yet";
  } catch (error) {
    statusEl.textContent = "Unavailable";
    statusEl.classList.add("status-error");
    detailEl.textContent = "Could not reach the background service worker";
    console.error("[DataFlow Guardian] popup status check failed", error);
  }
}

document.addEventListener("DOMContentLoaded", loadStatus);

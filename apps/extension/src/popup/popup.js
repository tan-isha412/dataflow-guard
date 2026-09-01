import { MESSAGE_TYPES } from "../shared/messageTypes.js";
import { sendToBackground } from "../shared/messaging.js";

const loginView = document.getElementById("loginView");
const sessionView = document.getElementById("sessionView");
const loginForm = document.getElementById("loginForm");
const loginButton = document.getElementById("loginButton");
const loginError = document.getElementById("loginError");

function renderSession(session) {
  if (session.authenticated) {
    loginView.hidden = true;
    sessionView.hidden = false;
    document.getElementById("userEmail").textContent = session.user?.email ?? "—";
    document.getElementById("orgName").textContent = session.organization?.name ?? "Unable to load";
    document.getElementById("userRole").textContent = session.role ?? "—";
  } else {
    sessionView.hidden = true;
    loginView.hidden = false;
  }
}

async function loadSession() {
  const response = await sendToBackground({ type: MESSAGE_TYPES.AUTH_GET_SESSION });
  if (response?.type === MESSAGE_TYPES.AUTH_SESSION_RESPONSE) {
    renderSession(response.payload);
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  loginError.hidden = true;
  loginButton.disabled = true;
  loginButton.textContent = "Logging in…";

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const response = await sendToBackground({ type: MESSAGE_TYPES.AUTH_LOGIN, payload: { email, password } });
    if (response?.payload?.success) {
      loginForm.reset();
      renderSession(response.payload.session);
    } else {
      loginError.textContent = response?.payload?.error?.message ?? "Login failed";
      loginError.hidden = false;
    }
  } catch (error) {
    loginError.textContent = "Could not reach the background service worker";
    loginError.hidden = false;
    console.error("[DataFlow Guardian] login failed", error);
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Log in";
  }
}

async function handleLogoutClick() {
  await sendToBackground({ type: MESSAGE_TYPES.AUTH_LOGOUT });
  renderSession({ authenticated: false });
}

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

    if (lastContentScriptPing) {
      const time = new Date(lastContentScriptPing.at).toLocaleTimeString();
      const destinationName = lastContentScriptPing.destination?.displayName;
      detailEl.textContent = destinationName ? `${destinationName} at ${time}` : `Last seen ${time}`;
    } else {
      detailEl.textContent = "No AI site activity yet";
    }
  } catch (error) {
    statusEl.textContent = "Unavailable";
    statusEl.classList.add("status-error");
    detailEl.textContent = "Could not reach the background service worker";
    console.error("[DataFlow Guardian] popup status check failed", error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadStatus();
  loadSession();
  loginForm.addEventListener("submit", handleLoginSubmit);
  document.getElementById("logoutButton").addEventListener("click", handleLogoutClick);
});

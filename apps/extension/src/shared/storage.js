/**
 * Thin wrapper around chrome.storage.local so extension state has a single
 * read/write path. Nothing sensitive (no tokens, no prompt content) is
 * stored yet — that lands in Phase 2 (auth) and Phase 4 (interception).
 */
const STORAGE_KEY = "dfg:extensionState";

const DEFAULT_STATE = Object.freeze({
  installedAt: null,
  lastContentScriptPing: null
});

export async function initializeExtensionState() {
  const existing = await getExtensionState();
  if (existing.installedAt) {
    return existing;
  }
  const state = { ...DEFAULT_STATE, installedAt: Date.now() };
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
  return state;
}

export async function getExtensionState() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return { ...DEFAULT_STATE, ...(result[STORAGE_KEY] ?? {}) };
}

export async function patchExtensionState(patch) {
  const current = await getExtensionState();
  const next = { ...current, ...patch };
  await chrome.storage.local.set({ [STORAGE_KEY]: next });
  return next;
}

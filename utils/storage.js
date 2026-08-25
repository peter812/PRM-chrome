/**
 * Storage wrapper for PRM Chrome Extension auth data.
 *
 * Uses chrome.storage.local for persistence of server URL, session token,
 * and session ID used by the 4-digit pairing code auth flow.
 */

const STORAGE_KEYS = {
  SERVER_URL: 'prmServerUrl',
  SESSION_TOKEN: 'extensionSessionToken',
  SESSION_ID: 'extensionSessionId',
  DARK_MODE: 'prmDarkMode',
  DEBUG_MODE: 'prmDebugMode',
};

/**
 * Retrieve a value from local storage.
 * @param {string} key
 * @returns {Promise<*>}
 */
function get(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get([key], (result) => {
      resolve(result[key] ?? null);
    });
  });
}

/**
 * Store a value in local storage.
 * @param {string} key
 * @param {*} value
 * @returns {Promise<void>}
 */
function set(key, value) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ [key]: value }, resolve);
  });
}

/**
 * Remove one or more keys from local storage.
 * @param {string|string[]} keys
 * @returns {Promise<void>}
 */
function remove(keys) {
  const keyArray = Array.isArray(keys) ? keys : [keys];
  return new Promise((resolve) => {
    chrome.storage.local.remove(keyArray, resolve);
  });
}

/**
 * Read the stored server URL and session token.
 * @returns {Promise<{ serverUrl: string|null, sessionToken: string|null, sessionId: string|null }>}
 */
async function getStoredConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      [STORAGE_KEYS.SERVER_URL, STORAGE_KEYS.SESSION_TOKEN, STORAGE_KEYS.SESSION_ID],
      (data) => {
        resolve({
          serverUrl: data[STORAGE_KEYS.SERVER_URL] ?? null,
          sessionToken: data[STORAGE_KEYS.SESSION_TOKEN] ?? null,
          sessionId: data[STORAGE_KEYS.SESSION_ID] ?? null,
        });
      },
    );
  });
}

/**
 * Save server URL, session token and session ID.
 * @param {string} serverUrl
 * @param {string} sessionToken
 * @param {string} sessionId
 * @returns {Promise<void>}
 */
async function saveConfig(serverUrl, sessionToken, sessionId) {
  return new Promise((resolve) => {
    chrome.storage.local.set(
      {
        [STORAGE_KEYS.SERVER_URL]: serverUrl,
        [STORAGE_KEYS.SESSION_TOKEN]: sessionToken,
        [STORAGE_KEYS.SESSION_ID]: sessionId,
      },
      resolve,
    );
  });
}

/**
 * Remove all stored auth data.
 * @returns {Promise<void>}
 */
async function clearConfig() {
  await remove([
    STORAGE_KEYS.SERVER_URL,
    STORAGE_KEYS.SESSION_TOKEN,
    STORAGE_KEYS.SESSION_ID,
  ]);
}

/**
 * Check whether the user has a server URL and session token stored.
 * @returns {Promise<boolean>}
 */
async function isConfigured() {
  const { serverUrl, sessionToken } = await getStoredConfig();
  return Boolean(serverUrl && sessionToken);
}

/**
 * Check whether the user has a server URL stored (but may not be paired yet).
 * @returns {Promise<boolean>}
 */
async function hasServerUrl() {
  const serverUrl = await get(STORAGE_KEYS.SERVER_URL);
  return Boolean(serverUrl);
}

export {
  STORAGE_KEYS,
  get,
  set,
  remove,
  getStoredConfig,
  saveConfig,
  clearConfig,
  isConfigured,
  hasServerUrl,
};

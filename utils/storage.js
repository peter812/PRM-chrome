/**
 * Thin wrapper around chrome.storage.sync for settings persistence.
 */

const STORAGE_KEYS = {
  API_URL: 'prm_api_url',
  API_KEY: 'prm_api_key',
};

/**
 * Retrieve a value from sync storage.
 * @param {string} key
 * @returns {Promise<*>}
 */
function get(key) {
  return new Promise((resolve) => {
    chrome.storage.sync.get([key], (result) => {
      resolve(result[key] ?? null);
    });
  });
}

/**
 * Store a value in sync storage.
 * @param {string} key
 * @param {*} value
 * @returns {Promise<void>}
 */
function set(key, value) {
  return new Promise((resolve) => {
    chrome.storage.sync.set({ [key]: value }, resolve);
  });
}

/**
 * Remove a key from sync storage.
 * @param {string} key
 * @returns {Promise<void>}
 */
function remove(key) {
  return new Promise((resolve) => {
    chrome.storage.sync.remove([key], resolve);
  });
}

/**
 * Check whether the user has saved both an API URL and an API key.
 * @returns {Promise<boolean>}
 */
async function isConfigured() {
  const apiUrl = await get(STORAGE_KEYS.API_URL);
  const apiKey = await get(STORAGE_KEYS.API_KEY);
  return Boolean(apiUrl && apiKey);
}

export { STORAGE_KEYS, get, set, remove, isConfigured };

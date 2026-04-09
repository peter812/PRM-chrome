/**
 * Settings page logic.
 *
 * Lets the user enter an API URL and API key, then validates them
 * by making a simple ping request to the API.
 */

import { STORAGE_KEYS, get, set } from '../../utils/storage.js';
import { ping } from '../../utils/api-client.js';

/**
 * Populate the form fields from saved storage values.
 */
async function loadSavedSettings() {
  const apiUrl = await get(STORAGE_KEYS.API_URL);
  const apiKey = await get(STORAGE_KEYS.API_KEY);
  if (apiUrl) document.getElementById('api-url').value = apiUrl;
  if (apiKey) document.getElementById('api-key').value = apiKey;
}

/**
 * Show a status message below the form.
 * @param {'success'|'error'|'info'} type
 * @param {string} message
 */
function showStatus(type, message) {
  const el = document.getElementById('settings-status');
  el.className = `status-message ${type}`;
  el.textContent = message;
}

/**
 * Initialise the settings page — load saved values and bind form submission.
 */
function initSettings() {
  loadSavedSettings();

  const form = document.getElementById('settings-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const apiUrl = document.getElementById('api-url').value.trim();
    const apiKey = document.getElementById('api-key').value.trim();

    if (!apiUrl || !apiKey) {
      showStatus('error', 'Both fields are required.');
      return;
    }

    const btn = document.getElementById('save-settings-btn');
    btn.disabled = true;
    btn.textContent = 'Verifying…';
    showStatus('info', 'Connecting to API…');

    try {
      const ok = await ping(apiUrl, apiKey);
      if (ok) {
        await set(STORAGE_KEYS.API_URL, apiUrl);
        await set(STORAGE_KEYS.API_KEY, apiKey);
        showStatus('success', 'Settings saved — API connection verified ✓');
      } else {
        showStatus('error', 'API responded with an error. Please check your URL and key.');
      }
    } catch (err) {
      showStatus('error', `Could not reach the API: ${err.message}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Save & Verify';
    }
  });
}

export { initSettings };

/**
 * Home page logic.
 *
 * Flow (from the node diagram):
 *   – If not configured (logged out): show prompt to go to Settings page.
 *   – If configured (logged in): automatically navigate to URL Info page.
 */

import { isConfigured } from '../../utils/storage.js';
import { navigateTo } from './router.js';

/**
 * Render the home page content.
 */
async function initHome() {
  const container = document.getElementById('home-content');
  const configured = await isConfigured();

  if (configured) {
    // User is "logged in" — redirect to URL Info page
    navigateTo('url-info', () => {
      // Trigger url-info initialisation through the callback wired in popup.js
      document.dispatchEvent(new CustomEvent('prm:show-url-info'));
    });
    return;
  }

  // Not configured — prompt to go to Settings
  container.innerHTML = `
    <div class="home-card">
      <h3>Welcome to PRM</h3>
      <p>To get started, please configure your API connection in the Settings page.</p>
      <button class="btn-primary" id="go-settings-btn">Go to Settings</button>
    </div>
  `;

  document.getElementById('go-settings-btn').addEventListener('click', () => {
    navigateTo('settings');
  });
}

export { initHome };

/**
 * URL Info page logic.
 *
 * Extracts the current tab's URL, checks it against the supported
 * platform list (Instagram, Facebook, LinkedIn, VSCO) and, if matched,
 * makes an API call to PRM for information about that URL.
 */

import { matchUrl, supportedPlatforms } from '../../utils/url-matcher.js';
import { getUrlInfo } from '../../utils/api-client.js';
import { isConfigured } from '../../utils/storage.js';

/**
 * Get the URL of the active tab.
 * @returns {Promise<string|null>}
 */
function getCurrentTabUrl() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      resolve(tabs[0]?.url ?? null);
    });
  });
}

/**
 * Render the URL Info page content.
 */
async function initUrlInfo() {
  const container = document.getElementById('url-info-content');

  // Ensure user is configured
  const configured = await isConfigured();
  if (!configured) {
    container.innerHTML = `
      <div class="status-message error" style="display:block">
        Please configure your API settings first.
      </div>`;
    return;
  }

  const tabUrl = await getCurrentTabUrl();
  if (!tabUrl) {
    container.innerHTML = '<p>Unable to read the current tab URL.</p>';
    return;
  }

  const { matched, platform } = matchUrl(tabUrl);

  // Build the badge
  const badgeClass = matched ? 'matched' : 'unmatched';
  const badgeText = matched ? `✔ ${platform}` : '✘ Not a supported platform';

  let html = `
    <span class="url-badge ${badgeClass}">${badgeText}</span>
    <div class="current-url">${escapeHtml(tabUrl)}</div>
  `;

  if (matched) {
    html += '<div id="api-result-box" class="api-result">Fetching info from PRM…</div>';
  } else {
    const platforms = supportedPlatforms();
    html += `
      <p>This URL does not match any supported platform. Supported platforms:</p>
      <ul class="platform-list">
        ${platforms.map((p) => `<li>${p}</li>`).join('')}
      </ul>
    `;
  }

  container.innerHTML = html;

  // If matched, call the API
  if (matched) {
    try {
      const data = await getUrlInfo(tabUrl);
      document.getElementById('api-result-box').textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      document.getElementById('api-result-box').textContent = `Error: ${err.message}`;
    }
  }
}

/**
 * Minimal HTML escaping to avoid XSS when inserting user-controlled URLs.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

export { initUrlInfo };

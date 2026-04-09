/**
 * URL Info page logic.
 *
 * Extracts the current tab's URL, checks it against the supported
 * platform list (Instagram, Facebook, LinkedIn, VSCO), extracts the
 * username from the URL, and searches PRM social accounts by username.
 */

import { matchUrl, extractUsername, supportedPlatforms } from '../../utils/url-matcher.js';
import { getUrlInfo, searchSocialAccounts } from '../../utils/api-client.js';
import { isConfigured } from '../../utils/storage.js';
import { navigateTo } from './router.js';
import { escapeHtml, renderSocialAccountCard } from './social-card.js';

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
 * Store search results so the Results page can display them.
 * @param {Array} results
 * @returns {Promise<void>}
 */
function storeSearchResults(results) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ prm_search_results: results }, resolve);
  });
}

/**
 * Render the URL Info page content.
 */
async function initUrlInfo() {
  const container = document.getElementById('url-info-content');
  if (!container) return;

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
  const { username } = extractUsername(tabUrl);

  // Build the badge
  const badgeClass = matched ? 'matched' : 'unmatched';
  const badgeText = matched ? `✔ ${platform}` : '✘ Not a supported platform';

  let html = `
    <span class="url-badge ${badgeClass}">${badgeText}</span>
    <div class="current-url">${escapeHtml(tabUrl)}</div>
  `;

  if (matched && username) {
    html += `
      <div class="username-extract">
        <span class="section-label">Extracted Username</span>
        <span class="username-value">${escapeHtml(username)}</span>
      </div>
      <div id="api-result-box" class="api-result">Searching social accounts for <strong>${escapeHtml(username)}</strong>…</div>
    `;
  } else if (matched) {
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

  // If matched with a username, search social accounts by username
  if (matched && username) {
    try {
      const data = await searchSocialAccounts(username, platform);
      const results = data.results || data.accounts || (Array.isArray(data) ? data : [data]);

      // Store results for the Results page
      await storeSearchResults(results);

      if (results.length === 0) {
        document.getElementById('api-result-box').innerHTML = `
          <p style="color: var(--color-text-tertiary);">No social accounts found for <strong>${escapeHtml(username)}</strong>.</p>
        `;
      } else {
        let resultHtml = `<p class="results-count text-xs mb-2">${results.length} account${results.length !== 1 ? 's' : ''} found</p>`;
        resultHtml += results.map(renderSocialAccountCard).join('');
        resultHtml += `
          <button class="btn btn-primary btn-sm" id="view-all-results-btn" style="margin-top:12px;">
            View All Results
          </button>
        `;
        document.getElementById('api-result-box').innerHTML = resultHtml;

        document.getElementById('view-all-results-btn')?.addEventListener('click', () => {
          navigateTo('results');
        });
      }
    } catch (err) {
      document.getElementById('api-result-box').textContent = `Error: ${err.message}`;
    }
  } else if (matched) {
    // Fallback to the original URL info API call
    try {
      const data = await getUrlInfo(tabUrl);
      document.getElementById('api-result-box').textContent = JSON.stringify(data, null, 2);
    } catch (err) {
      document.getElementById('api-result-box').textContent = `Error: ${err.message}`;
    }
  }
}

export { initUrlInfo };

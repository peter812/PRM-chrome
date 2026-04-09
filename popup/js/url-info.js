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

/**
 * Render a social account card from API search results.
 * @param {object} account
 * @returns {string}
 */
function renderSocialAccountCard(account) {
  const name = account.name || account.full_name || account.username || 'Unknown';
  const username = account.username || account.handle || '';
  const platform = account.platform || '';
  const bio = account.bio || account.description || '';
  const followers = account.followers || account.follower_count || '';
  const profileUrl = account.profile_url || account.url || '';
  const avatar = account.avatar_url || account.profile_pic_url || '';

  return `
    <div class="social-account-card">
      <div class="social-account-header">
        ${avatar ? `<img class="social-account-avatar" src="${escapeHtml(avatar)}" alt="" />` : `<div class="social-account-avatar-placeholder">${escapeHtml(name.charAt(0).toUpperCase())}</div>`}
        <div class="social-account-info">
          <span class="social-account-name">${escapeHtml(name)}</span>
          ${username ? `<span class="social-account-username">@${escapeHtml(username)}</span>` : ''}
        </div>
        ${platform ? `<span class="badge badge-info">${escapeHtml(platform)}</span>` : ''}
      </div>
      ${bio ? `<p class="social-account-bio">${escapeHtml(bio)}</p>` : ''}
      <div class="social-account-meta">
        ${followers ? `<span class="social-account-stat">👥 ${escapeHtml(String(followers))} followers</span>` : ''}
        ${profileUrl ? `<a class="social-account-link" href="${escapeHtml(profileUrl)}" target="_blank" rel="noopener noreferrer">View Profile ↗</a>` : ''}
      </div>
    </div>
  `;
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

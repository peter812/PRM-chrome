/**
 * Results page logic.
 *
 * Displays social account search results and scraped data
 * from chrome.storage.local in a card view.
 */

/**
 * Retrieve stored scrape results from local storage.
 * @returns {Promise<Array>}
 */
function getScrapeResults() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['prm_results'], (data) => {
      resolve(data.prm_results ?? []);
    });
  });
}

/**
 * Retrieve stored social account search results from local storage.
 * @returns {Promise<Array>}
 */
function getSearchResults() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['prm_search_results'], (data) => {
      resolve(data.prm_search_results ?? []);
    });
  });
}

/**
 * Clear all stored results.
 * @returns {Promise<void>}
 */
function clearResults() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(['prm_results', 'prm_search_results'], resolve);
  });
}

/**
 * Minimal HTML escaping to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/**
 * Format an ISO timestamp to a human-readable relative time or date.
 * @param {string} iso
 * @returns {string}
 */
function formatTime(iso) {
  if (!iso) return '—';
  const date = new Date(iso);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

/**
 * Render a social account card from search results.
 * @param {object} account
 * @returns {string}
 */
function renderSocialAccountCard(account) {
  const name = account.name || account.full_name || account.username || 'Unknown';
  const username = account.username || account.handle || '';
  const platform = account.platform || '';
  const bio = account.bio || account.description || '';
  const followers = account.followers || account.follower_count || '';
  const following = account.following || account.following_count || '';
  const posts = account.posts || account.post_count || '';
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
        ${followers ? `<span class="social-account-stat">👥 ${escapeHtml(String(followers))}</span>` : ''}
        ${following ? `<span class="social-account-stat">➡ ${escapeHtml(String(following))}</span>` : ''}
        ${posts ? `<span class="social-account-stat">📄 ${escapeHtml(String(posts))}</span>` : ''}
        ${profileUrl ? `<a class="social-account-link" href="${escapeHtml(profileUrl)}" target="_blank" rel="noopener noreferrer">View Profile ↗</a>` : ''}
      </div>
    </div>
  `;
}

/**
 * Render a single scrape result card.
 * @param {object} result
 * @returns {string}
 */
function renderScrapeResultCard(result) {
  const platform = result.platform
    ? `<span class="badge badge-info result-card-platform">${escapeHtml(result.platform)}</span>`
    : '';

  const dataPreview = result.data
    ? `<div class="result-card-data">${escapeHtml(
        typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2)
      )}</div>`
    : '';

  return `
    <div class="result-card">
      <div class="result-card-header">
        <span class="result-card-url">${escapeHtml(result.url || 'Unknown URL')}</span>
        <span class="result-card-time">${formatTime(result.timestamp)}</span>
      </div>
      ${platform}
      ${dataPreview}
    </div>
  `;
}

/**
 * Render the empty state for the results page.
 * @returns {string}
 */
function renderEmptyState() {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
      </div>
      <h3>No results yet</h3>
      <p>Search for a social account by visiting a profile on a supported platform, or view scraped data here.</p>
    </div>
  `;
}

/**
 * Initialise the results page.
 */
async function initResults() {
  const container = document.getElementById('results-content');
  if (!container) return;

  const searchResults = await getSearchResults();
  const scrapeResults = await getScrapeResults();

  const hasSearch = searchResults.length > 0;
  const hasScrape = scrapeResults.length > 0;

  if (!hasSearch && !hasScrape) {
    container.innerHTML = renderEmptyState();
  } else {
    let html = '';

    // Social account search results section
    if (hasSearch) {
      html += `
        <div class="results-section">
          <span class="section-label">Social Account Search Results</span>
          <p class="results-count text-xs mb-2">${searchResults.length} account${searchResults.length !== 1 ? 's' : ''} found</p>
          ${searchResults.map(renderSocialAccountCard).join('')}
        </div>
      `;
    }

    // Scraped data results section
    if (hasScrape) {
      if (hasSearch) {
        html += '<div class="divider"></div>';
      }
      const sorted = [...scrapeResults].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      html += `
        <div class="results-section">
          <span class="section-label">Scraped Data</span>
          <p class="results-count text-xs mb-2">${sorted.length} result${sorted.length !== 1 ? 's' : ''}</p>
          ${sorted.map(renderScrapeResultCard).join('')}
        </div>
      `;
    }

    container.innerHTML = html;
  }

  // Bind clear button
  const clearBtn = document.getElementById('clear-results-btn');
  if (clearBtn) {
    clearBtn.onclick = async () => {
      await clearResults();
      container.innerHTML = renderEmptyState();
    };
  }
}

export { initResults };

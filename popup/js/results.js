/**
 * Results page logic.
 *
 * Displays scraped data from chrome.storage.local in a card view,
 * filterable by URL, with timestamps and platform badges.
 */

/**
 * Retrieve stored results from local storage.
 * @returns {Promise<Array>}
 */
function getResults() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['prm_results'], (data) => {
      resolve(data.prm_results ?? []);
    });
  });
}

/**
 * Clear all stored results.
 * @returns {Promise<void>}
 */
function clearResults() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(['prm_results'], resolve);
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
 * Render a single result card.
 * @param {object} result
 * @returns {string}
 */
function renderResultCard(result) {
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
      <p>Scraped data from supported platforms will appear here.</p>
    </div>
  `;
}

/**
 * Initialise the results page.
 */
async function initResults() {
  const container = document.getElementById('results-content');
  if (!container) return;

  const results = await getResults();

  if (results.length === 0) {
    container.innerHTML = renderEmptyState();
  } else {
    // Show newest first
    const sorted = [...results].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    container.innerHTML =
      `<p class="results-count text-xs mb-2">${sorted.length} result${sorted.length !== 1 ? 's' : ''}</p>` +
      sorted.map(renderResultCard).join('');
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

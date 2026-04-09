/**
 * Home page logic.
 *
 * Flow:
 *   – If not configured (logged out): show welcome card with prompt to go to Settings.
 *   – If configured (logged in): show dashboard with quick stats and status.
 */

import { isConfigured } from '../../utils/storage.js';
import { navigateTo } from './router.js';
import { supportedPlatforms } from '../../utils/url-matcher.js';

/**
 * Get the count of cached results.
 * @returns {Promise<number>}
 */
function getResultsCount() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['prm_results'], (data) => {
      resolve((data.prm_results ?? []).length);
    });
  });
}

/**
 * Render the home page content.
 */
async function initHome() {
  const container = document.getElementById('home-content');
  if (!container) return;

  const configured = await isConfigured();

  if (!configured) {
    // Not configured — show welcome state
    container.innerHTML = `
      <div class="home-card" style="text-align:center; padding:32px 20px;">
        <div style="margin-bottom:16px;">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="var(--color-accent)" width="48" height="48">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
          </svg>
        </div>
        <h3>Welcome to PRM</h3>
        <p style="margin-top:8px;">Connect your PRM API to start tracking relationships across social platforms.</p>
        <button class="btn btn-primary" id="go-settings-btn" style="margin-top:20px;">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
          Configure Settings
        </button>
      </div>
    `;

    document.getElementById('go-settings-btn').addEventListener('click', () => {
      navigateTo('settings');
    });
    return;
  }

  // Configured — show dashboard
  const resultsCount = await getResultsCount();
  const platforms = supportedPlatforms();

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value">${platforms.length}</div>
        <div class="stat-label">Platforms</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">${resultsCount}</div>
        <div class="stat-label">Results</div>
      </div>
      <div class="stat-card">
        <div class="stat-value" style="color: var(--color-success-text);">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" width="24" height="24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        </div>
        <div class="stat-label">Connected</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:12px;">
      <div class="card-header">
        <span class="card-title">Quick Actions</span>
      </div>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button class="btn btn-secondary btn-sm" id="home-go-urlinfo">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="14" height="14">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
          </svg>
          Check Current Tab
        </button>
        <button class="btn btn-secondary btn-sm" id="home-go-results">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="14" height="14">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          View Results
        </button>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">Supported Platforms</span>
      </div>
      <ul class="platform-list" style="margin:0;">
        ${platforms.map((p) => `<li>${p}</li>`).join('')}
      </ul>
    </div>
  `;

  // Bind quick action buttons
  document.getElementById('home-go-urlinfo')?.addEventListener('click', () => {
    navigateTo('url-info');
  });
  document.getElementById('home-go-results')?.addEventListener('click', () => {
    navigateTo('results');
  });
}

export { initHome };

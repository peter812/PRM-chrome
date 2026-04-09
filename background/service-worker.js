/**
 * Background service worker for PRM Chrome Extension.
 *
 * Responsibilities:
 *   - Listen for tab updates and check URLs against the allow-list.
 *   - Update the extension badge to reflect match status.
 *   - Programmatically inject content scripts (stealth + scraper) on matched URLs.
 *   - Relay scraped data to the PRM API and cache results locally.
 */

/* global chrome */

// ── Imports (service worker compatible) ─────────────────
// Note: ES module imports are not available in MV3 service workers by default.
// We inline the required logic or use importScripts for non-module scripts.

/**
 * Supported platform patterns (mirrors utils/url-matcher.js).
 */
const SUPPORTED_DOMAINS = [
  { name: 'Instagram', pattern: /^https?:\/\/(www\.)?instagram\.com\//i },
  { name: 'Facebook', pattern: /^https?:\/\/(www\.)?facebook\.com\//i },
  { name: 'LinkedIn', pattern: /^https?:\/\/(www\.)?linkedin\.com\//i },
  { name: 'VSCO', pattern: /^https?:\/\/(www\.)?vsco\.co\//i },
];

/**
 * Check if a URL matches any supported domain.
 * @param {string} url
 * @returns {{ matched: boolean, platform: string|null }}
 */
function matchUrl(url) {
  for (const domain of SUPPORTED_DOMAINS) {
    if (domain.pattern.test(url)) {
      return { matched: true, platform: domain.name };
    }
  }
  return { matched: false, platform: null };
}

// ── Badge colours ──────────────────────────────────────
const BADGE_MATCHED = { color: '#065f46', text: '✓' };
const BADGE_UNMATCHED = { color: '', text: '' };

/**
 * Update the extension badge for a given tab.
 * @param {number} tabId
 * @param {boolean} matched
 */
function updateBadge(tabId, matched) {
  const { color, text } = matched ? BADGE_MATCHED : BADGE_UNMATCHED;
  chrome.action.setBadgeText({ text, tabId });
  if (color) {
    chrome.action.setBadgeBackgroundColor({ color, tabId });
  }
}

// ── Content script injection ────────────────────────────

/**
 * Inject the stealth and scraper content scripts into a tab.
 * The stealth script runs in the MAIN world to patch navigator properties;
 * the scraper runs in the ISOLATED world so it has chrome.runtime access.
 * @param {number} tabId
 * @param {string} platform
 */
async function injectContentScripts(tabId, platform) {
  try {
    // Inject stealth patches into the page context (MAIN world)
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/stealth.js'],
      world: 'MAIN',
    });

    // Inject scraper into the isolated extension world
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/scraper.js'],
    });

    // eslint-disable-next-line no-console
    console.log(`[PRM] Content scripts injected for ${platform} on tab ${tabId}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(`[PRM] Failed to inject scripts on tab ${tabId}:`, err.message);
  }
}

/**
 * Request extraction from the content script.
 * @param {number} tabId
 * @param {string} platform
 * @returns {Promise<object|null>}
 */
function requestExtraction(tabId, platform) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(
      tabId,
      { type: 'PRM_EXTRACT', platform },
      (response) => {
        if (chrome.runtime.lastError) {
          // eslint-disable-next-line no-console
          console.warn('[PRM] Extraction message failed:', chrome.runtime.lastError.message);
          resolve(null);
          return;
        }
        resolve(response ?? null);
      },
    );
  });
}

/**
 * Store a scrape result in local storage.
 * @param {object} result
 */
async function cacheResult(result) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['prm_results'], (data) => {
      const results = data.prm_results ?? [];
      results.push(result);
      // Keep the most recent 200 results
      const trimmed = results.slice(-200);
      chrome.storage.local.set({ prm_results: trimmed }, resolve);
    });
  });
}

/**
 * Send scraped data to the configured PRM API.
 * @param {object} result
 */
async function sendToApi(result) {
  try {
    const data = await new Promise((resolve) => {
      chrome.storage.sync.get(['prm_api_url', 'prm_api_key'], (d) => resolve(d));
    });

    const apiUrl = data.prm_api_url;
    const apiKey = data.prm_api_key;
    if (!apiUrl || !apiKey) return;

    const url = `${apiUrl.replace(/\/+$/, '')}/api/v1/scrape-results`;

    await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(result),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[PRM] Failed to send result to API:', err.message);
  }
}

/**
 * Fetch with exponential back-off retry.
 * @param {string} url
 * @param {RequestInit} options
 * @param {number} [maxRetries=3]
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options, maxRetries = 3) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (err) {
      lastError = err;
    }
    // Exponential back-off: 500ms, 1s, 2s, …
    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
    }
  }
  throw lastError;
}

// ── Track which tabs already have scripts injected ──────
const injectedTabs = new Set();

// ── Event listeners ─────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  // eslint-disable-next-line no-console
  console.log('[PRM] Chrome Extension installed.');
});

/**
 * Listen for tab URL changes. Handles both navigation start (clear injection
 * tracker) and page load complete (badge update + content script injection).
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // When navigation starts, clear the injection tracker for this tab
  if (changeInfo.status === 'loading') {
    injectedTabs.delete(tabId);
    return;
  }

  // Only proceed when the page has finished loading and we have a URL
  if (changeInfo.status !== 'complete' || !tab.url) return;

  const { matched, platform } = matchUrl(tab.url);
  updateBadge(tabId, matched);

  if (matched && !injectedTabs.has(tabId)) {
    injectedTabs.add(tabId);
    await injectContentScripts(tabId, platform);

    // Small delay to let the content script initialise
    setTimeout(async () => {
      const result = await requestExtraction(tabId, platform);
      if (result && result.success) {
        await cacheResult(result);
        await sendToApi(result);
      }
    }, 1500);
  }
});

/**
 * Clean up when a tab is closed.
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  injectedTabs.delete(tabId);
});

/**
 * Handle the active tab change — update badge for the newly focused tab.
 */
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      const { matched } = matchUrl(tab.url);
      updateBadge(activeInfo.tabId, matched);
    }
  } catch {
    // Tab may have been closed
  }
});

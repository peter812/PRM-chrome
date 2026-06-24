/**
 * Background service worker for PRM Chrome Extension.
 *
 * Responsibilities:
 *   - Periodic session ping (every 5 minutes) to keep session alive.
 *   - Session validation — clear credentials and update badge on 401.
 *   - Listen for tab updates and check URLs against the allow-list.
 *   - Update the extension badge to reflect match / connection status.
 *   - Programmatically inject content scripts (stealth + scraper) on matched URLs.
 *   - Relay scraped data to the PRM API and cache results locally.
 */

/* global chrome */

// ── Inline helpers (ES module imports not available in MV3 service workers) ──

/**
 * Supported platform patterns (mirrors utils/url-matcher.js).
 */
const SUPPORTED_DOMAINS = [
  { name: 'Instagram', pattern: /^https?:\/\/(www\.)?instagram\.com\//i },
  { name: 'Facebook', pattern: /^https?:\/\/(www\.)?facebook\.com\//i },
  { name: 'LinkedIn', pattern: /^https?:\/\/(www\.)?linkedin\.com\//i },
  { name: 'VSCO', pattern: /^https?:\/\/(www\.)?vsco\.co\//i },
];

const STORAGE_KEYS = {
  SERVER_URL: 'prmServerUrl',
  SESSION_TOKEN: 'extensionSessionToken',
  SESSION_ID: 'extensionSessionId',
};

/**
 * Check if a URL matches any supported domain.
 */
function matchUrl(url) {
  for (const domain of SUPPORTED_DOMAINS) {
    if (domain.pattern.test(url)) {
      return { matched: true, platform: domain.name };
    }
  }
  return { matched: false, platform: null };
}

/**
 * Read stored config from chrome.storage.local.
 */
function getStoredConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      [STORAGE_KEYS.SERVER_URL, STORAGE_KEYS.SESSION_TOKEN, STORAGE_KEYS.SESSION_ID],
      (data) => {
        resolve({
          serverUrl: data[STORAGE_KEYS.SERVER_URL] ?? null,
          sessionToken: data[STORAGE_KEYS.SESSION_TOKEN] ?? null,
          sessionId: data[STORAGE_KEYS.SESSION_ID] ?? null,
        });
      },
    );
  });
}

/**
 * Clear all stored auth data.
 */
function clearConfig() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(
      [STORAGE_KEYS.SERVER_URL, STORAGE_KEYS.SESSION_TOKEN, STORAGE_KEYS.SESSION_ID],
      resolve,
    );
  });
}

/**
 * Ping the session to keep it alive.
 * POST {serverUrl}/api/extension-auth/ping with X-Extension-Token header.
 */
async function pingSession(serverUrl, token) {
  const url = `${serverUrl.replace(/\/+$/, '')}/api/extension-auth/ping`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'X-Extension-Token': token },
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

// ── Badge colours ──────────────────────────────────────
const BADGE_MATCHED = { color: '#065f46', text: '✓' };
const BADGE_UNMATCHED = { color: '', text: '' };
const BADGE_DISCONNECTED = { color: '#EF4444', text: '!' };

/**
 * Update the extension badge for a given tab.
 */
function updateBadge(tabId, matched) {
  const { color, text } = matched ? BADGE_MATCHED : BADGE_UNMATCHED;
  chrome.action.setBadgeText({ text, tabId });
  if (color) {
    chrome.action.setBadgeBackgroundColor({ color, tabId });
  }
}

// ── Periodic session ping ────────────────────────────────

// Create alarm only if it doesn't already exist
chrome.alarms.get('ping-prm', (existing) => {
  if (!existing) {
    chrome.alarms.create('ping-prm', { periodInMinutes: 5 });
  }
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'ping-prm') return;

  const config = await getStoredConfig();
  if (config.serverUrl && config.sessionToken) {
    const isValid = await pingSession(config.serverUrl, config.sessionToken);
    if (!isValid) {
      await clearConfig();
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#EF4444' });
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
  }
});

// ── Content script injection ────────────────────────────

/**
 * Inject the stealth and scraper content scripts into a tab.
 */
async function injectContentScripts(tabId, platform) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/stealth.js'],
      world: 'MAIN',
    });

    if (platform === 'Instagram') {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/inject.js'],
        world: 'MAIN',
      });
    }

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
 */
async function cacheResult(result) {
  return new Promise((resolve) => {
    chrome.storage.local.get(['prm_results'], (data) => {
      const results = data.prm_results ?? [];
      results.push(result);
      const trimmed = results.slice(-200);
      chrome.storage.local.set({ prm_results: trimmed }, resolve);
    });
  });
}

/**
 * Send scraped data to the PRM API using the extension session token.
 */
async function sendToApi(result) {
  try {
    const config = await getStoredConfig();
    if (!config.serverUrl || !config.sessionToken) return;

    const url = `${config.serverUrl.replace(/\/+$/, '')}/api/v1/scrape-results`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);

    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-Token': config.sessionToken,
      },
      body: JSON.stringify(result),
      signal: controller.signal,
    });

    clearTimeout(timer);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[PRM] Failed to send result to API:', err.message);
  }
}

// ── Track which tabs already have scripts injected ──────
const injectedTabs = new Set();

// ── Event listeners ─────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  // eslint-disable-next-line no-console
  console.log('[PRM] Chrome Extension installed.');
});

/**
 * Listen for tab URL changes.
 */
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'loading') {
    injectedTabs.delete(tabId);
    return;
  }

  if (changeInfo.status !== 'complete' || !tab.url) return;

  const { matched, platform } = matchUrl(tab.url);
  updateBadge(tabId, matched);

  if (matched && !injectedTabs.has(tabId)) {
    injectedTabs.add(tabId);
    await injectContentScripts(tabId, platform);

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
 * Handle the active tab change.
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

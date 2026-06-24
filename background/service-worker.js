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

// ── Background Debug Tracker ──
const backgroundDebugTracker = {
  enabled: false,
  activeTask: null,

  async init() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['prmDebugMode'], (res) => {
        this.enabled = res.prmDebugMode === true;
        resolve();
      });
    });
  },

  startTask(name) {
    if (!this.enabled) return;
    this.activeTask = {
      name,
      startTime: new Date(),
      subtasks: []
    };
  },

  startSubtask(name) {
    if (!this.enabled || !this.activeTask) return;
    this.activeTask.subtasks.push({
      name,
      startTime: new Date()
    });
  },

  completeSubtask(name) {
    if (!this.enabled || !this.activeTask) return;
    const sub = this.activeTask.subtasks.find(s => s.name === name && s.duration === undefined);
    if (sub) {
      sub.duration = `${new Date() - sub.startTime}ms`;
    }
  },

  addSubtaskDirect(name, startTimeStr, durationStr) {
    if (!this.enabled || !this.activeTask) return;
    this.activeTask.subtasks.push({
      name,
      startTimeStr,
      duration: durationStr
    });
  },

  completeTask() {
    if (!this.enabled || !this.activeTask) return null;
    const taskDuration = `${new Date() - this.activeTask.startTime}ms`;
    const startTimeStr = this.activeTask.startTime.toISOString();

    let log = `${this.activeTask.name} (${startTimeStr} - ${taskDuration})\n`;
    for (const sub of this.activeTask.subtasks) {
      const timeStr = sub.startTimeStr || sub.startTime.toISOString();
      const durStr = sub.duration || 'in progress';
      log += `- ${sub.name} (${timeStr} - ${durStr})\n`;
    }

    this.activeTask = null;
    return log;
  }
};

/**
 * Check which post IDs already exist in the database.
 */
async function checkDuplicatePostIds(serverUrl, token, postIds) {
  if (!postIds || postIds.length === 0) return [];
  const url = `${serverUrl.replace(/\/+$/, '')}/api/v1/posts/check`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Extension-Token': token
    },
    body: JSON.stringify({ postIds })
  });
  if (!res.ok) {
    throw new Error(`Failed to check duplicates: HTTP ${res.status}`);
  }
  const data = await res.json();
  return data.existingPostIds || [];
}

/**
 * Perform background post scraping and importing.
 */
async function runBackgroundPostImport({ onlyLatest, tabId, username }) {
  await backgroundDebugTracker.init();
  backgroundDebugTracker.startTask(onlyLatest ? 'Add Most Recent Post' : 'Import Posts');

  const startTime = Date.now();
  async function updateStatus(status, msg, progress = null, isFinished = false, errorMsg = null) {
    const jobStatus = {
      active: !isFinished,
      type: onlyLatest ? 'latest' : 'all',
      username: username,
      status: status,
      message: msg,
      progress: progress,
      error: errorMsg,
      startTime: startTime
    };
    await chrome.storage.local.set({ prm_import_job_status: jobStatus });
  }

  try {
    await updateStatus('info', 'Loading posts feed from Instagram...');

    // 1. Inject content script
    backgroundDebugTracker.startSubtask('Inject content script');
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/scraper.js'],
      });
    } catch (e) {
      // Ignore
    }
    backgroundDebugTracker.completeSubtask('Inject content script');

    await new Promise(resolve => setTimeout(resolve, 500));

    // 2. Fetch feed
    backgroundDebugTracker.startSubtask('Fetch Instagram Feed via messaging');
    const response = await new Promise((resolve) => {
      chrome.tabs.sendMessage(tabId, { type: 'PRM_GET_INSTAGRAM_FEED', username }, (res) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(res);
        }
      });
    });
    backgroundDebugTracker.completeSubtask('Fetch Instagram Feed via messaging');

    if (!response || !response.success) {
      throw new Error(response ? response.error : 'Failed to fetch Instagram feed.');
    }

    const posts = response.posts;
    if (!posts || posts.length === 0) {
      await updateStatus('info', 'No posts found on this profile.', null, true);
      return;
    }

    const config = await getStoredConfig();
    if (!config.serverUrl || !config.sessionToken) {
      throw new Error('Not connected to PRM. Please verify server settings.');
    }

    let postsToImport = [];
    let duplicateCount = 0;
    let importedCount = 0;

    if (onlyLatest) {
      const sortedPosts = [...posts].sort((a, b) => (b.taken_at || 0) - (a.taken_at || 0));
      const post = sortedPosts[0];

      await updateStatus('info', `Found ${posts.length} posts. Checking if the most recent post exists in PRM...`);

      backgroundDebugTracker.startSubtask('Check Duplicate Post ID via PRM API');
      let existingIds = [];
      try {
        existingIds = await checkDuplicatePostIds(config.serverUrl, config.sessionToken, [post.post_id]);
      } catch (e) {
        console.warn('[PRM] Failed to check duplicate for latest post:', e);
      }
      backgroundDebugTracker.completeSubtask('Check Duplicate Post ID via PRM API');

      if (existingIds.includes(post.post_id)) {
        await updateStatus('success', `The most recent post (@${post.shortcode}) already exists in PRM.`, null, true);
        return;
      }
      postsToImport = [post];
    } else {
      await updateStatus('info', `Found ${posts.length} posts. Checking for existing posts in PRM...`);

      backgroundDebugTracker.startSubtask('Check Duplicate Post IDs via PRM API');
      let existingIds = [];
      try {
        existingIds = await checkDuplicatePostIds(config.serverUrl, config.sessionToken, posts.map(p => p.post_id));
      } catch (e) {
        console.warn('[PRM] Failed to check duplicates before import:', e);
      }
      backgroundDebugTracker.completeSubtask('Check Duplicate Post IDs via PRM API');

      const existingSet = new Set(existingIds);
      postsToImport = posts.filter(p => !existingSet.has(p.post_id));
      duplicateCount = existingSet.size;

      if (postsToImport.length === 0) {
        await updateStatus('success', `Import completed! All ${posts.length} posts already existed in PRM.`, null, true);
        return;
      }
    }

    // Sequentially download and import
    for (let i = 0; i < postsToImport.length; i++) {
      const post = postsToImport[i];
      const progressMsg = onlyLatest 
        ? `Downloading and importing the most recent post (@${post.shortcode})...`
        : `Importing post ${i + 1} of ${postsToImport.length} (@${post.shortcode})...`;

      await updateStatus('info', progressMsg, onlyLatest ? null : { current: i + 1, total: postsToImport.length });

      backgroundDebugTracker.startSubtask(`Download media for ${post.shortcode}`);
      const downloadResponse = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tabId, {
          type: 'PRM_DOWNLOAD_MEDIA',
          shortcode: post.shortcode,
          mediaUrls: post.mediaUrls
        }, (res) => {
          if (chrome.runtime.lastError) {
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(res);
          }
        });
      });
      backgroundDebugTracker.completeSubtask(`Download media for ${post.shortcode}`);

      if (!downloadResponse || !downloadResponse.success) {
        console.warn(`[PRM] Failed to download media for post ${post.shortcode}:`, downloadResponse ? downloadResponse.error : 'Unknown error');
        if (onlyLatest) {
          throw new Error(`Failed to download media for post ${post.shortcode}: ${downloadResponse ? downloadResponse.error : 'Unknown error'}`);
        }
        continue;
      }

      const payload = {
        username: username,
        platform: 'Instagram',
        post: {
          post_id: post.post_id,
          shortcode: post.shortcode,
          caption: post.caption,
          taken_at: post.taken_at,
          media_type: post.media_type,
          media: downloadResponse.media
        }
      };

      backgroundDebugTracker.startSubtask(`Import post ${post.shortcode} via PRM API`);
      const url = `${config.serverUrl.replace(/\/+$/, '')}/api/v1/posts/import`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Extension-Token': config.sessionToken
        },
        body: JSON.stringify(payload)
      });
      backgroundDebugTracker.completeSubtask(`Import post ${post.shortcode} via PRM API`);

      if (!res.ok) {
        console.warn(`[PRM] Failed to import post ${post.shortcode}: HTTP ${res.status}`);
        if (onlyLatest) {
          throw new Error(`Failed to import post ${post.shortcode}: HTTP ${res.status}`);
        }
        continue;
      }

      const resData = await res.json();
      if (resData.status === 'already_exists') {
        duplicateCount++;
      } else {
        importedCount++;
      }

      if (i < postsToImport.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // Set success status
    if (onlyLatest) {
      await updateStatus('success', `Successfully imported the most recent post (@${postsToImport[0].shortcode}) to PRM!`, null, true);
    } else {
      await updateStatus('success', `Import completed! Successfully imported ${importedCount} posts (${duplicateCount} already existed).`, null, true);
    }

  } catch (err) {
    console.error('[PRM] Background post import error:', err);
    await updateStatus('error', `Import failed: ${err.message || 'unknown error'}`, null, true, err.message || 'unknown error');
  } finally {
    const log = backgroundDebugTracker.completeTask();
    if (log) {
      chrome.storage.local.get(['prm_pending_debug_logs'], (data) => {
        const pending = data.prm_pending_debug_logs || [];
        const filename = onlyLatest 
          ? `prm-debug-import-latest-${Date.now()}.txt`
          : `prm-debug-import-posts-${Date.now()}.txt`;
        pending.push({ filename, content: log });
        chrome.storage.local.set({ prm_pending_debug_logs: pending });
      });
    }
  }
}

// ── Debug Tracing for Service Worker Outgoing Requests ──

let originalFetch = globalThis.fetch;

function enableBackgroundFetchHook() {
  if (globalThis.fetch === originalFetch) {
    globalThis.fetch = async function (resource, init) {
      let url = '';
      let method = 'GET';
      if (typeof resource === 'string') {
        url = resource;
      } else if (resource && typeof resource === 'object' && resource.url) {
        url = resource.url;
      }
      if (init && init.method) {
        method = init.method.toUpperCase();
      }

      const data = await new Promise((resolve) => {
        chrome.storage.local.get(['prmServerUrl', 'prmDebugMode'], resolve);
      });

      const isDebug = data.prmDebugMode === true;
      const serverUrl = data.prmServerUrl;

      if (
        isDebug &&
        serverUrl &&
        url.startsWith(serverUrl.replace(/\/+$/, ''))
      ) {
        let traceInfo;
        if (backgroundDebugTracker.activeTask) {
          traceInfo = `task=${encodeURIComponent(backgroundDebugTracker.activeTask.name)};subtask=Network Request: ${method} ${encodeURIComponent(url)}`;
        } else {
          traceInfo = `context=background;method=${method};url=${encodeURIComponent(url)}`;
        }
        init = {
          ...(init || {}),
          headers: {
            ...(init && init.headers ? init.headers : {}),
            'X-PRM-Trace': traceInfo,
          },
        };
      }

      if (backgroundDebugTracker.enabled && backgroundDebugTracker.activeTask) {
        const subtaskName = `Network Request: ${method} ${url}`;
        const startTime = new Date();
        const startTimeStr = startTime.toISOString();
        try {
          const response = await originalFetch.call(globalThis, resource, init);
          const duration = new Date() - startTime;
          backgroundDebugTracker.addSubtaskDirect(subtaskName, startTimeStr, `${duration}ms`);
          return response;
        } catch (err) {
          const duration = new Date() - startTime;
          backgroundDebugTracker.addSubtaskDirect(`${subtaskName} (Failed: ${err.message})`, startTimeStr, `${duration}ms`);
          throw err;
        }
      }

      return originalFetch.call(globalThis, resource, init);
    };
  }
}

function disableBackgroundFetchHook() {
  if (globalThis.fetch !== originalFetch) {
    globalThis.fetch = originalFetch;
  }
}

// Initialise based on current storage
chrome.storage.local.get(['prmDebugMode'], (result) => {
  if (result.prmDebugMode === true) {
    enableBackgroundFetchHook();
    backgroundDebugTracker.enabled = true;
  }
});

// Clean up any stale active jobs from a previous extension run on startup
chrome.storage.local.get(['prm_import_job_status'], (res) => {
  const status = res.prm_import_job_status;
  if (status && status.active) {
    chrome.storage.local.set({
      prm_import_job_status: {
        ...status,
        active: false,
        status: 'error',
        message: 'Import interrupted (extension restarted).'
      }
    });
  }
});

// Watch for toggle changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.prmDebugMode) {
    if (changes.prmDebugMode.newValue === true) {
      enableBackgroundFetchHook();
      backgroundDebugTracker.enabled = true;
    } else {
      disableBackgroundFetchHook();
      backgroundDebugTracker.enabled = false;
    }
  }
});

// Runtime messaging listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_POST_IMPORT') {
    runBackgroundPostImport(message);
    sendResponse({ success: true });
    return false;
  }
});

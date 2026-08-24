/**
 * Popup bootstrap — manages the 3-view auth flow + tabbed connected view:
 *   View 1: Server URL input (not connected)
 *   View 2: 4-digit code entry (server connected, not paired)
 *   View 3: Connected — two tabs: Scraper & Settings
 */

import { getStoredConfig, saveConfig, clearConfig, set, get, STORAGE_KEYS } from '../../utils/storage.js';
import { pingServer, verifyCode, bulkImportScrapedContacts } from '../../utils/api-client.js';
import { debugTracker } from '../../utils/debug-tracker.js';

// ── DOM references ──────────────────────────────────────

const viewServerUrl = () => document.getElementById('view-server-url');
const viewCodeEntry = () => document.getElementById('view-code-entry');
const viewConnected = () => document.getElementById('view-connected');

// ── View switching ──────────────────────────────────────

function showView(viewId) {
  document.querySelectorAll('.view').forEach((v) => {
    v.style.display = 'none';
  });
  const target = document.getElementById(viewId);
  if (target) {
    target.style.display = 'block';
  }
}

// ── Status helpers ──────────────────────────────────────

function showStatus(elementId, type, message) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.className = `status-message ${type}`;
  el.textContent = message;
  el.style.display = 'block';
}

function clearStatus(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.className = 'status-message';
  el.textContent = '';
  el.style.display = 'none';
}

// ── Minimal HTML escaping ───────────────────────────────

function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// ── View 1: Server URL ─────────────────────────────────

function initServerUrlView() {
  const form = document.getElementById('server-url-form');
  const input = document.getElementById('server-url-input');
  const btn = document.getElementById('connect-btn');
  if (!btn || !input) return;

  async function handleConnect(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    clearStatus('server-url-status');

    let rawUrl = input.value.trim();
    if (!rawUrl) {
      showStatus('server-url-status', 'error', 'Please enter your PRM server URL.');
      input.focus();
      return false;
    }

    // Auto-normalize (e.g. localhost:3000 -> http://localhost:3000)
    let finalUrl = rawUrl.replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(finalUrl)) {
      if (/^(localhost|127\.0\.0\.1|192\.168\.|10\.|0\.0\.0\.0)/i.test(finalUrl)) {
        finalUrl = `http://${finalUrl}`;
      } else {
        finalUrl = `https://${finalUrl}`;
      }
    }

    btn.disabled = true;
    btn.textContent = 'Connecting…';
    showStatus('server-url-status', 'info', `Connecting to ${finalUrl}…`);

    try {
      const result = await pingServer(finalUrl);

      if (!result.ok) {
        showStatus('server-url-status', 'error', result.error || 'Could not connect to server. Check the URL and network.');
        return false;
      }

      const connectedUrl = result.normalizedUrl || finalUrl;
      showStatus('server-url-status', 'success', 'Server reachable! Proceeding to code pairing…');

      // Update target text and switch view
      const serverText = document.getElementById('code-entry-server-text');
      if (serverText) serverText.textContent = `Server: ${connectedUrl}`;

      // Save to storage
      await set(STORAGE_KEYS.SERVER_URL, connectedUrl);

      setTimeout(() => {
        showView('view-code-entry');
        document.querySelector('.code-digit')?.focus();
      }, 600);

    } catch (err) {
      showStatus('server-url-status', 'error', `Connection error: ${err.message || 'Unknown error'}`);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Connect';
    }

    return false;
  }

  btn.onclick = handleConnect;
  if (form) form.onsubmit = handleConnect;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleConnect(e);
    }
  };
}

// ── View 2: Code Entry ─────────────────────────────────

function initCodeEntryView() {
  const digits = document.querySelectorAll('.code-digit');
  const verifyBtn = document.getElementById('verify-btn');
  const form = document.getElementById('code-entry-form');

  function getCode() {
    return Array.from(digits)
      .map((d) => d.value)
      .join('');
  }

  function updateVerifyBtn() {
    const code = getCode();
    if (verifyBtn) verifyBtn.disabled = code.length !== 4;
  }

  function clearDigits() {
    digits.forEach((d) => (d.value = ''));
    digits[0]?.focus();
    updateVerifyBtn();
  }

  async function handleVerify(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    clearStatus('code-entry-status');

    const code = getCode();
    if (code.length !== 4) return;

    if (verifyBtn) {
      verifyBtn.disabled = true;
      verifyBtn.textContent = 'Verifying…';
    }

    try {
      const { serverUrl } = await getStoredConfig();
      if (!serverUrl) {
        showStatus('code-entry-status', 'error', 'No server URL configured.');
        showView('view-server-url');
        return;
      }

      const result = await verifyCode(serverUrl, code);

      if (result.success) {
        await saveConfig(serverUrl, result.sessionToken, result.sessionId);
        showView('view-connected');
        await setupContextualTabs();
      } else {
        showStatus(
          'code-entry-status',
          'error',
          result.error || 'Invalid or expired code. Check PRM settings for a new code.',
        );
        clearDigits();
      }
    } catch (err) {
      showStatus('code-entry-status', 'error', `Verification failed: ${err.message || 'Cannot reach server'}`);
      clearDigits();
    } finally {
      if (verifyBtn) {
        verifyBtn.disabled = false;
        verifyBtn.textContent = 'Verify';
      }
      updateVerifyBtn();
    }
  }

  // Auto-advance on input, only accept digits
  digits.forEach((digit, i) => {
    digit.addEventListener('input', () => {
      digit.value = digit.value.replace(/[^0-9]/g, '').slice(-1);

      if (digit.value && i < digits.length - 1) {
        digits[i + 1].focus();
      }
      updateVerifyBtn();

      // Auto-submit on 4th digit
      if (getCode().length === 4) {
        handleVerify();
      }
    });

    digit.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !digit.value && i > 0) {
        digits[i - 1].focus();
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        handleVerify();
      }
    });

    // Handle paste of full code
    digit.addEventListener('paste', (e) => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData)
        .getData('text')
        .replace(/[^0-9]/g, '')
        .slice(0, 4);

      for (let j = 0; j < pasted.length && i + j < digits.length; j++) {
        digits[i + j].value = pasted[j];
      }
      const nextIndex = Math.min(i + pasted.length, digits.length - 1);
      digits[nextIndex].focus();
      updateVerifyBtn();

      if (getCode().length === 4) {
        handleVerify();
      }
    });
  });

  if (verifyBtn) verifyBtn.addEventListener('click', handleVerify);
  if (form) form.addEventListener('submit', handleVerify);

  // Change server URL link
  document.getElementById('change-server-btn')?.addEventListener('click', async () => {
    await clearConfig();
    showView('view-server-url');
    document.getElementById('server-url-input')?.focus();
  });
}

// ── Tab switching & Contextual Visibility ────────────────

function isInstagramUrl(url) {
  return /^https?:\/\/([a-zA-Z0-9-]+\.)*instagram\.com(\/|$)/i.test(url || '');
}

function isTrueDbUrl(url) {
  return /^https?:\/\/([a-zA-Z0-9-]+\.)*truepeoplesearch\.com(\/|$)/i.test(url || '');
}

function activateTab(tabId) {
  const tabButtons = document.querySelectorAll('.tab-btn');

  tabButtons.forEach((b) => {
    const isActive = b.dataset.tab === tabId;
    b.classList.toggle('tab-active', isActive);
    b.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  document.querySelectorAll('.tab-panel').forEach((p) => {
    p.style.display = p.id === tabId ? '' : 'none';
  });

  if (tabId === 'tab-truedb') {
    detectTrueDbPage();
  } else if (tabId === 'tab-scraper') {
    detectCurrentPage();
  } else if (tabId === 'tab-audience') {
    refreshAudienceUI();
  }
}

async function setupContextualTabs() {
  const scraperBtn = document.getElementById('tab-btn-scraper') || document.querySelector('.tab-btn[data-tab="tab-scraper"]');
  const audienceBtn = document.getElementById('tab-btn-audience') || document.querySelector('.tab-btn[data-tab="tab-audience"]');
  const truedbBtn = document.getElementById('tab-btn-truedb') || document.querySelector('.tab-btn[data-tab="tab-truedb"]');
  const settingsBtn = document.getElementById('tab-btn-settings') || document.querySelector('.tab-btn[data-tab="tab-settings"]');

  let currentUrl = '';
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentUrl = (tab && tab.url) ? tab.url : '';
  } catch (err) {
    console.error('Error querying active tab:', err);
  }

  const isInstagram = isInstagramUrl(currentUrl);
  const isTrueDb = isTrueDbUrl(currentUrl);

  if (scraperBtn) scraperBtn.style.display = isInstagram ? '' : 'none';
  if (audienceBtn) audienceBtn.style.display = '';
  if (truedbBtn) truedbBtn.style.display = isTrueDb ? '' : 'none';
  if (settingsBtn) settingsBtn.style.display = '';

  if (isInstagram) {
    activateTab('tab-scraper');
  } else if (isTrueDb) {
    activateTab('tab-truedb');
  } else {
    activateTab('tab-settings');
  }
}

function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.tab;
      if (!targetId) return;
      activateTab(targetId);
    });
  });
}

// ── Dark Mode Toggle ────────────────────────────────────

async function initDarkMode() {
  const toggle = document.getElementById('dark-mode-toggle');
  if (!toggle) return;

  // Load stored preference
  const storedTheme = await get(STORAGE_KEYS.DARK_MODE);
  if (storedTheme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    toggle.checked = true;
  } else if (storedTheme === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
    toggle.checked = false;
  } else {
    // No preference stored — follow system; check if system prefers dark
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    toggle.checked = prefersDark;
  }

  toggle.addEventListener('change', async () => {
    const theme = toggle.checked ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    await set(STORAGE_KEYS.DARK_MODE, theme);
  });
}

// ── Debug Mode Toggle & Timing Tracing ──────────────────

async function initDebugMode() {
  const toggle = document.getElementById('debug-mode-toggle');
  if (!toggle) return;

  // Load stored preference
  const isEnabled = await debugTracker.isEnabled();
  toggle.checked = isEnabled;

  toggle.addEventListener('change', async () => {
    await debugTracker.setEnabled(toggle.checked);
  });
}

/**
 * Trigger a browser download of a text or csv file in the popup context.
 * @param {string} filename
 * @param {string} text
 * @param {string} [mimeType]
 */
function downloadTxtFile(filename, text, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Instagram URL matching (mirrors url-matcher.js) ─────

const NON_PROFILE_PATHS = ['p', 'reel', 'stories', 'explore', 'accounts', 'direct', 'reels'];

/**
 * Check if a URL is an Instagram profile page.
 * @param {string} url
 * @returns {{ isProfile: boolean, username: string|null }}
 */
function checkInstagramProfile(url) {
  if (!isInstagramUrl(url)) return { isProfile: false, username: null };

  try {
    const parsed = new URL(url);
    const segments = parsed.pathname.split('/').filter((s) => s.length > 0);
    if (segments.length === 0) return { isProfile: false, username: null };
    if (NON_PROFILE_PATHS.includes(segments[0])) return { isProfile: false, username: null };
    return { isProfile: true, username: segments[0] };
  } catch {
    return { isProfile: false, username: null };
  }
}

/**
 * Check which post IDs already exist in the database.
 * @param {string} serverUrl
 * @param {string} token
 * @param {string[]} postIds
 * @returns {Promise<string[]>} list of existing post IDs
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

// ── Scraper Tab Logic ───────────────────────────────────

/**
 * Detect the current tab's URL and update the scraper UI.
 */
async function detectCurrentPage() {
  const urlText = document.getElementById('current-url-text');
  const platformBadge = document.getElementById('scraper-platform-badge');
  const platformName = document.getElementById('scraper-platform-name');
  const scrapeBtn = document.getElementById('scrape-btn');
  const importPostsBtn = document.getElementById('import-posts-btn');
  const importLatestPostBtn = document.getElementById('import-latest-post-btn');
  const extractFollowersBtn = document.getElementById('extract-followers-btn');
  const extractFollowingBtn = document.getElementById('extract-following-btn');

  const grabAccountImportBtn = document.getElementById('grab-account-import-btn');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      urlText.textContent = 'No page detected';
      scrapeBtn.disabled = true;
      if (importPostsBtn) {
        importPostsBtn.style.display = 'none';
        importPostsBtn.disabled = true;
      }
      if (importLatestPostBtn) {
        importLatestPostBtn.style.display = 'none';
        importLatestPostBtn.disabled = true;
      }
      if (extractFollowersBtn) {
        extractFollowersBtn.style.display = 'none';
        extractFollowersBtn.disabled = true;
      }
      if (extractFollowingBtn) {
        extractFollowingBtn.style.display = 'none';
        extractFollowingBtn.disabled = true;
      }
      if (grabAccountImportBtn) {
        grabAccountImportBtn.style.display = 'none';
        grabAccountImportBtn.disabled = true;
      }
      platformBadge.style.display = 'none';
      return;
    }

    urlText.textContent = tab.url;

    const { isProfile, username } = checkInstagramProfile(tab.url);

    if (isProfile && username) {
      platformBadge.style.display = '';
      platformName.textContent = `Instagram · @${escapeHtml(username)}`;
      if (importPostsBtn) importPostsBtn.style.display = '';
      if (importLatestPostBtn) importLatestPostBtn.style.display = '';
      if (extractFollowersBtn) {
        extractFollowersBtn.style.display = '';
        extractFollowersBtn.disabled = false;
      }
      if (extractFollowingBtn) {
        extractFollowingBtn.style.display = '';
        extractFollowingBtn.disabled = false;
      }
      if (grabAccountImportBtn) {
        grabAccountImportBtn.style.display = '';
        grabAccountImportBtn.disabled = false;
      }
      const audienceInput = document.getElementById('audience-target-input');
      if (audienceInput && !audienceInput.value) {
        audienceInput.value = username;
      }
    } else {
      platformBadge.style.display = 'none';
      if (importPostsBtn) importPostsBtn.style.display = 'none';
      if (importLatestPostBtn) importLatestPostBtn.style.display = 'none';
      if (extractFollowersBtn) extractFollowersBtn.style.display = 'none';
      if (extractFollowingBtn) extractFollowingBtn.style.display = 'none';
      if (grabAccountImportBtn) grabAccountImportBtn.style.display = 'none';
    }

    chrome.storage.local.get(['prm_import_job_status', 'prm_full_import_job_status'], (res) => {
      if (res.prm_full_import_job_status && res.prm_full_import_job_status.active) {
        updateUIWithFullImportStatus(res.prm_full_import_job_status);
      } else {
        updateUIWithJobStatus(res.prm_import_job_status);
      }
    });

  } catch {
    urlText.textContent = 'Unable to read current tab';
    scrapeBtn.disabled = true;
    if (importPostsBtn) {
      importPostsBtn.style.display = 'none';
      importPostsBtn.disabled = true;
    }
    if (importLatestPostBtn) {
      importLatestPostBtn.style.display = 'none';
      importLatestPostBtn.disabled = true;
    }
    if (extractFollowersBtn) {
      extractFollowersBtn.style.display = 'none';
      extractFollowersBtn.disabled = true;
    }
    if (extractFollowingBtn) {
      extractFollowingBtn.style.display = 'none';
      extractFollowingBtn.disabled = true;
    }
    if (grabAccountImportBtn) {
      grabAccountImportBtn.style.display = 'none';
      grabAccountImportBtn.disabled = true;
    }
    platformBadge.style.display = 'none';
  }
}

function updateUIWithFullImportStatus(jobStatus) {
  const grabAccountImportBtn = document.getElementById('grab-account-import-btn');
  if (!grabAccountImportBtn) return;

  if (jobStatus && jobStatus.active) {
    grabAccountImportBtn.disabled = true;
    grabAccountImportBtn.textContent = `Importing @${jobStatus.username}…`;
    showStatus('scrape-status', jobStatus.status || 'info', jobStatus.message);
  } else {
    restoreButtonHtml(grabAccountImportBtn, 'Grab Followers & Following to PRM');
    if (jobStatus && jobStatus.message) {
      showStatus('scrape-status', jobStatus.status || 'info', jobStatus.message);
    }
  }
}

function updateUIWithJobStatus(jobStatus) {
  const scrapeBtn = document.getElementById('scrape-btn');
  const importPostsBtn = document.getElementById('import-posts-btn');
  const importLatestPostBtn = document.getElementById('import-latest-post-btn');
  const extractFollowersBtn = document.getElementById('extract-followers-btn');
  const extractFollowingBtn = document.getElementById('extract-following-btn');
  const grabAccountImportBtn = document.getElementById('grab-account-import-btn');
  if (!scrapeBtn) return;

  if (jobStatus && jobStatus.active) {
    scrapeBtn.disabled = true;
    if (importPostsBtn) {
      importPostsBtn.disabled = true;
      if (jobStatus.type === 'all') {
        if (jobStatus.progress) {
          importPostsBtn.textContent = `Importing ${jobStatus.progress.current}/${jobStatus.progress.total}…`;
        } else {
          importPostsBtn.textContent = 'Connecting…';
        }
      } else {
        restoreButtonHtml(importPostsBtn, 'Import Posts to PRM');
      }
    }
    if (importLatestPostBtn) {
      importLatestPostBtn.disabled = true;
      if (jobStatus.type === 'latest') {
        importLatestPostBtn.textContent = 'Importing latest…';
      } else {
        restoreButtonHtml(importLatestPostBtn, 'Add Most Recent Post to PRM');
      }
    }
    if (extractFollowersBtn) extractFollowersBtn.disabled = true;
    if (extractFollowingBtn) extractFollowingBtn.disabled = true;
    if (grabAccountImportBtn) grabAccountImportBtn.disabled = true;
    showStatus('scrape-status', jobStatus.status, jobStatus.message);
  } else {
    if (importPostsBtn) {
      restoreButtonHtml(importPostsBtn, 'Import Posts to PRM');
    }
    if (importLatestPostBtn) {
      restoreButtonHtml(importLatestPostBtn, 'Add Most Recent Post to PRM');
    }
    if (grabAccountImportBtn) {
      restoreButtonHtml(grabAccountImportBtn, 'Grab Followers & Following to PRM');
    }


    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs && tabs.length > 0 ? tabs[0] : null;
      const { isProfile, username } = tab && tab.url ? checkInstagramProfile(tab.url) : { isProfile: false, username: null };
      
      scrapeBtn.disabled = !isProfile;
      if (importPostsBtn) {
        importPostsBtn.disabled = !isProfile;
      }
      if (importLatestPostBtn) {
        importLatestPostBtn.disabled = !isProfile;
      }
      if (extractFollowersBtn) {
        extractFollowersBtn.disabled = !isProfile;
      }
      if (extractFollowingBtn) {
        extractFollowingBtn.disabled = !isProfile;
      }

      if (jobStatus && isProfile && username && username === jobStatus.username) {
        showStatus('scrape-status', jobStatus.status, jobStatus.message);
      } else {
        clearStatus('scrape-status');
      }
    });
  }
}

function restoreButtonHtml(btn, label) {
  if (btn.querySelector('svg')) return;
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
    ${label}
  `;
}

function checkAndDownloadPendingLogs() {
  chrome.storage.local.get(['prm_pending_debug_logs'], (data) => {
    const pending = data.prm_pending_debug_logs || [];
    if (pending.length > 0) {
      for (const log of pending) {
        downloadTxtFile(log.filename, log.content);
      }
      chrome.storage.local.remove(['prm_pending_debug_logs']);
    }
  });
}

/**
 * Display scraped data in the card.
 * @param {object} data
 */
function displayScrapedData(data) {
  const card = document.getElementById('scraped-data-card');
  if (!card || !data) return;

  const fields = ['username', 'displayName', 'bio', 'bioLink', 'followers', 'following'];
  for (const field of fields) {
    const el = document.getElementById(`scraped-${field}`);
    if (el) {
      el.textContent = data[field] || '—';
    }
  }
  card.style.display = '';
}

function initScraperTab() {
  const scrapeBtn = document.getElementById('scrape-btn');
  const importPostsBtn = document.getElementById('import-posts-btn');
  const importLatestPostBtn = document.getElementById('import-latest-post-btn');
  if (!scrapeBtn) return;

  scrapeBtn.addEventListener('click', async () => {
    debugTracker.startTask('Scrape Profile');
    clearStatus('scrape-status');
    scrapeBtn.disabled = true;
    if (importPostsBtn) importPostsBtn.disabled = true;
    if (importLatestPostBtn) importLatestPostBtn.disabled = true;
    scrapeBtn.textContent = 'Scraping…';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        showStatus('scrape-status', 'error', 'No active tab found.');
        return;
      }

      // Inject content script if not already present, then send extraction message
      debugTracker.startSubtask('Inject content script');
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/scraper.js'],
        });
      } catch {
        // Script may already be injected — proceed
      }
      debugTracker.completeSubtask('Inject content script');

      // Brief delay for the content script to initialize after injection
      const SCRIPT_INIT_DELAY_MS = 500;
      await new Promise((resolve) => setTimeout(resolve, SCRIPT_INIT_DELAY_MS));

      debugTracker.startSubtask('Extract profile data via messaging');
      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'PRM_EXTRACT',
        platform: 'Instagram',
      });
      debugTracker.completeSubtask('Extract profile data via messaging');

      if (response && response.success && response.data) {
        showStatus('scrape-status', 'success', 'Profile scraped successfully!');
        displayScrapedData(response.data);
      } else {
        showStatus('scrape-status', 'error', 'Could not extract profile data. Make sure you are on an Instagram profile page.');
      }
    } catch (err) {
      showStatus('scrape-status', 'error', `Scraping failed: ${err.message || 'unknown error'}`);
    } finally {
      scrapeBtn.disabled = false;
      scrapeBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" width="16" height="16">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
        </svg>
        Scrape Profile
      `;

      // Re-check if button should be enabled using the actual tab URL
      try {
        const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const { isProfile } = checkInstagramProfile(currentTab?.url || '');
        scrapeBtn.disabled = !isProfile;
        if (importPostsBtn) {
          importPostsBtn.disabled = !isProfile;
        }
        if (importLatestPostBtn) {
          importLatestPostBtn.disabled = !isProfile;
        }
      } catch {
        scrapeBtn.disabled = true;
        if (importPostsBtn) {
          importPostsBtn.disabled = true;
        }
        if (importLatestPostBtn) {
          importLatestPostBtn.disabled = true;
        }
      }

      const log = debugTracker.completeTask();
      if (log) {
        downloadTxtFile(`prm-debug-scrape-profile-${Date.now()}.txt`, log);
      }
    }
  });

  if (importPostsBtn) {
    importPostsBtn.addEventListener('click', async () => {
      clearStatus('scrape-status');
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        showStatus('scrape-status', 'error', 'No active tab found.');
        return;
      }

      const { isProfile, username } = checkInstagramProfile(tab.url);
      if (!isProfile || !username) {
        showStatus('scrape-status', 'error', 'Invalid Instagram profile page.');
        return;
      }

      scrapeBtn.disabled = true;
      importPostsBtn.disabled = true;
      if (importLatestPostBtn) importLatestPostBtn.disabled = true;
      importPostsBtn.textContent = 'Connecting…';

      try {
        chrome.runtime.sendMessage({
          type: 'START_POST_IMPORT',
          onlyLatest: false,
          tabId: tab.id,
          username: username
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('[PRM] Failed to start background post import:', chrome.runtime.lastError.message);
            showStatus('scrape-status', 'error', `Failed to start import: ${chrome.runtime.lastError.message}`);
            updateUIWithJobStatus(null);
          } else {
            console.log('[PRM] Background post import started:', response);
          }
        });
      } catch (err) {
        console.error('[PRM] sendMessage exception:', err);
        showStatus('scrape-status', 'error', `Failed to start import: ${err.message}`);
        updateUIWithJobStatus(null);
      }
    });
  }

  if (importLatestPostBtn) {
    importLatestPostBtn.addEventListener('click', async () => {
      clearStatus('scrape-status');
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        showStatus('scrape-status', 'error', 'No active tab found.');
        return;
      }

      const { isProfile, username } = checkInstagramProfile(tab.url);
      if (!isProfile || !username) {
        showStatus('scrape-status', 'error', 'Invalid Instagram profile page.');
        return;
      }

      scrapeBtn.disabled = true;
      importPostsBtn.disabled = true;
      importLatestPostBtn.disabled = true;
      importLatestPostBtn.textContent = 'Connecting…';

      try {
        chrome.runtime.sendMessage({
          type: 'START_POST_IMPORT',
          onlyLatest: true,
          tabId: tab.id,
          username: username
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('[PRM] Failed to start background post import:', chrome.runtime.lastError.message);
            showStatus('scrape-status', 'error', `Failed to start import: ${chrome.runtime.lastError.message}`);
            updateUIWithJobStatus(null);
          } else {
            console.log('[PRM] Background post import started:', response);
          }
        });
      } catch (err) {
        console.error('[PRM] sendMessage exception:', err);
        showStatus('scrape-status', 'error', `Failed to start import: ${err.message}`);
        updateUIWithJobStatus(null);
      }
    });
  }

  const extractFollowersBtn = document.getElementById('extract-followers-btn');
  const extractFollowingBtn = document.getElementById('extract-following-btn');

  if (extractFollowersBtn) {
    extractFollowersBtn.addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const { username } = checkInstagramProfile(tab?.url || '');
      if (username) {
        const input = document.getElementById('audience-target-input');
        if (input) input.value = username;
        const select = document.getElementById('audience-type-select');
        if (select) select.value = 'followers';
        activateTab('tab-audience');
      }
    });
  }

  if (extractFollowingBtn) {
    extractFollowingBtn.addEventListener('click', async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const { username } = checkInstagramProfile(tab?.url || '');
      if (username) {
        const input = document.getElementById('audience-target-input');
        if (input) input.value = username;
        const select = document.getElementById('audience-type-select');
        if (select) select.value = 'following';
        activateTab('tab-audience');
      }
    });
  }

  const grabAccountImportBtn = document.getElementById('grab-account-import-btn');
  if (grabAccountImportBtn) {
    grabAccountImportBtn.addEventListener('click', async () => {
      clearStatus('scrape-status');
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        showStatus('scrape-status', 'error', 'No active tab found.');
        return;
      }

      const { isProfile, username } = checkInstagramProfile(tab.url);
      if (!isProfile || !username) {
        showStatus('scrape-status', 'error', 'Invalid Instagram profile page. Please navigate to an Instagram profile.');
        return;
      }

      grabAccountImportBtn.disabled = true;
      grabAccountImportBtn.textContent = 'Connecting…';

      try {
        chrome.runtime.sendMessage({
          type: 'START_FULL_ACCOUNT_IMPORT',
          username: username
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('[PRM] Failed to start full account import:', chrome.runtime.lastError.message);
            showStatus('scrape-status', 'error', `Failed to start import: ${chrome.runtime.lastError.message}`);
          } else {
            console.log('[PRM] Full account import started:', response);
            showStatus('scrape-status', 'info', `Started full account import for @${username}...`);
          }
        });
      } catch (err) {
        console.error('[PRM] sendMessage exception:', err);
        showStatus('scrape-status', 'error', `Failed to start import: ${err.message}`);
      }
    });
  }
}


let refreshAudienceUI = () => {};

// ── Audience / Follower Scraper Tab Logic ────────────────

function initAudienceTab() {
  const targetInput = document.getElementById('audience-target-input');
  const typeSelect = document.getElementById('audience-type-select');
  const limitInput = document.getElementById('audience-limit-input');
  const delayInput = document.getElementById('audience-delay-input');
  const startBtn = document.getElementById('audience-start-btn');
  const cancelBtn = document.getElementById('audience-cancel-btn');
  const progressCard = document.getElementById('audience-progress-card');
  const progressTarget = document.getElementById('audience-progress-target');
  const progressCount = document.getElementById('audience-progress-count');
  const progressFill = document.getElementById('audience-progress-fill');
  const statusMsg = document.getElementById('audience-status-msg');
  const actionsDiv = document.getElementById('audience-actions');
  const importPrmBtn = document.getElementById('audience-import-prm-btn');
  const exportCsvBtn = document.getElementById('audience-export-csv-btn');
  const exportJsonBtn = document.getElementById('audience-export-json-btn');

  if (!startBtn) return;

  // Open in Tab link — opens this popup as a full browser tab
  const openTabLink = document.getElementById('audience-open-tab');
  if (openTabLink) {
    // Hide the link if we're already running in a tab (not a popup)
    const isPopup = window.innerWidth < 500;
    if (!isPopup) {
      openTabLink.style.display = 'none';
    } else {
      openTabLink.addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: chrome.runtime.getURL('popup/index.html') });
        window.close();
      });
    }
  }

  function renderTaskState(task, contacts = []) {
    if (!task) {
      if (progressCard) progressCard.style.display = 'none';
      if (startBtn) startBtn.disabled = false;
      if (cancelBtn) cancelBtn.style.display = 'none';
      if (targetInput) targetInput.disabled = false;
      if (typeSelect) typeSelect.disabled = false;
      if (limitInput) limitInput.disabled = false;
      if (delayInput) delayInput.disabled = false;
      if (actionsDiv) actionsDiv.style.display = 'none';
      return;
    }

    if (progressCard) progressCard.style.display = '';
    if (progressTarget) progressTarget.textContent = `@${task.username || 'unknown'} (${task.type || 'followers'})`;

    const countText = task.maxLimit && Number(task.maxLimit) > 0 && task.maxLimit !== Infinity
      ? `${task.totalExtracted || 0} / ${task.maxLimit} extracted`
      : `${task.totalExtracted || 0} extracted`;
    if (progressCount) progressCount.textContent = countText;

    if (progressFill) {
      if (task.maxLimit && Number(task.maxLimit) > 0 && task.maxLimit !== Infinity) {
        const pct = Math.min(100, Math.round(((task.totalExtracted || 0) / task.maxLimit) * 100));
        progressFill.style.width = `${pct}%`;
      } else {
        progressFill.style.width = '100%';
      }
    }

    if (statusMsg) {
      let statusType = 'info';
      if (task.status === 'error') statusType = 'error';
      else if (task.status === 'success') statusType = 'success';
      else if (task.status === 'warning' || task.status === 'stopped') statusType = 'warning';
      else statusType = 'info';

      statusMsg.className = `status-message ${statusType}`;
      statusMsg.textContent = task.message || '';
      statusMsg.style.display = task.message ? 'block' : 'none';
    }

    if (task.active) {
      startBtn.disabled = true;
      if (cancelBtn) {
        cancelBtn.style.display = '';
        cancelBtn.disabled = false;
      }
      if (targetInput) {
        if (!targetInput.value && task.username) targetInput.value = task.username;
        targetInput.disabled = true;
      }
      if (typeSelect) {
        if (task.type) typeSelect.value = task.type;
        typeSelect.disabled = true;
      }
      if (limitInput) limitInput.disabled = true;
      if (delayInput) delayInput.disabled = true;
      if (actionsDiv) actionsDiv.style.display = 'none';
    } else {
      startBtn.disabled = false;
      if (cancelBtn) cancelBtn.style.display = 'none';
      if (targetInput) targetInput.disabled = false;
      if (typeSelect) typeSelect.disabled = false;
      if (limitInput) limitInput.disabled = false;
      if (delayInput) delayInput.disabled = false;
      if (contacts && contacts.length > 0) {
        if (actionsDiv) actionsDiv.style.display = 'flex';
      } else {
        if (actionsDiv) actionsDiv.style.display = 'none';
      }
    }
  }

  refreshAudienceUI = () => {
    chrome.storage.local.get(['prm_ig_scrape_task', 'prm_ig_scraped_contacts'], (res) => {
      let task = res.prm_ig_scrape_task;
      const contacts = res.prm_ig_scraped_contacts || [];
      if (task && task.active) {
        const lastUpd = task.lastUpdated || task.startTime || 0;
        // If task hasn't updated in 12s, the popup context died when closed
        if (Date.now() - lastUpd > 12000) {
          task = {
            ...task,
            active: false,
            status: 'warning',
            message: `Extraction paused when popup closed (${contacts.length} collected).`,
            finishedAt: Date.now()
          };
          chrome.storage.local.set({ prm_ig_scrape_task: task });
        }
      }
      renderTaskState(task, contacts);
    });
  };

  // Check storage on load
  refreshAudienceUI();

  let shouldCancel = false;

  async function runScrape(username, scrapeType, maxLimit, baseDelay) {
    shouldCancel = false;
    const numericLimit = (maxLimit && maxLimit > 0) ? maxLimit : Infinity;
    const safeLimitForStorage = numericLimit === Infinity ? 0 : numericLimit;
    const startTime = Date.now();

    const updateTask = (status, message, totalExtracted = 0, isFinished = false) => {
      const task = {
        active: !isFinished, username, type: scrapeType,
        totalExtracted, maxLimit: safeLimitForStorage,
        status, message, startTime,
        lastUpdated: Date.now(),
        finishedAt: isFinished ? Date.now() : null
      };
      chrome.storage.local.set({ prm_ig_scrape_task: task });
    };

    try {
      updateTask('info', `Resolving @${username}...`);

      const headers = {
        'accept': '*/*',
        'x-asbd-id': '198387',
        'x-ig-app-id': '936619743392459',
        'x-requested-with': 'XMLHttpRequest'
      };
      try {
        const csrf = await chrome.cookies.get({ url: 'https://www.instagram.com', name: 'csrftoken' });
        if (csrf?.value) headers['x-csrftoken'] = csrf.value;
      } catch (_) {}

      // Resolve user ID
      let userId = null;
      try {
        const res = await fetch(`https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`, {
          headers, credentials: 'include'
        });
        if (res.ok) userId = (await res.json())?.data?.user?.id;
      } catch (_) {}

      if (!userId) {
        try {
          const res = await fetch(`https://www.instagram.com/web/search/topsearch/?context=blended&query=${encodeURIComponent(username)}&include_reel=false`, {
            headers, credentials: 'include'
          });
          if (res.ok) {
            const d = await res.json();
            userId = d.users?.find(u => u.user.username.toLowerCase() === username.toLowerCase())?.user?.pk;
          }
        } catch (_) {}
      }

      if (!userId) throw new Error(`Could not find @${username}. Make sure you are logged into Instagram in this browser.`);

      const queryHash = scrapeType === 'following' ? '58712303d941c6855d4e888c5f0cd22f' : '37479f2b8209594dde7facb0d904896a';
      const edgeKey = scrapeType === 'following' ? 'edge_follow' : 'edge_followed_by';
      let endCursor = '', hasNextPage = true, totalCollected = 0;
      const allContacts = [];

      updateTask('info', `Starting ${scrapeType} extraction...`);

      while (hasNextPage && totalCollected < numericLimit) {
        if (shouldCancel) {
          updateTask('warning', `Stopped. Collected ${totalCollected} profiles.`, totalCollected, true);
          return;
        }

        const count = Math.min(50, numericLimit - totalCollected);
        const variables = { id: String(userId), include_reel: false, fetch_mutual: false, first: count };
        if (endCursor) variables.after = endCursor;

        const url = `https://www.instagram.com/graphql/query/?query_hash=${queryHash}&variables=${encodeURIComponent(JSON.stringify(variables))}`;
        let responseData = null;

        for (let attempt = 0; attempt < 3; attempt++) {
          const res = await fetch(url, { headers, credentials: 'include' });
          if (res.status === 429) {
            const backoff = (attempt + 1) * 5000;
            updateTask('warning', `Rate limited. Waiting ${backoff / 1000}s...`, totalCollected);
            await new Promise(r => setTimeout(r, backoff));
            continue;
          }
          if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
          responseData = await res.json();
          break;
        }

        if (!responseData?.data?.user) throw new Error('Could not parse Instagram response. Are you logged in?');

        const edge = responseData.data.user[edgeKey];
        if (!edge?.edges?.length) break;

        const batch = edge.edges.map(e => ({
          id: e.node.id, username: e.node.username, fullName: e.node.full_name,
          isPrivate: e.node.is_private, isVerified: e.node.is_verified,
          profilePicUrl: e.node.profile_pic_url
        }));

        allContacts.push(...batch);
        totalCollected += batch.length;
        endCursor = edge.page_info?.end_cursor || '';
        hasNextPage = !!edge.page_info?.has_next_page && !!endCursor;

        chrome.storage.local.set({ prm_ig_scraped_contacts: allContacts });
        updateTask('running', `Scraped ${totalCollected} ${scrapeType}...`, totalCollected);

        if (hasNextPage && totalCollected < numericLimit) {
          const jitter = baseDelay + Math.ceil(baseDelay * 0.25 * Math.random());
          await new Promise(r => setTimeout(r, jitter));
        }
      }

      updateTask('success', `Complete! Extracted ${totalCollected} ${scrapeType}.`, totalCollected, true);
    } catch (err) {
      console.error('[PRM] Instagram scrape error:', err);
      updateTask('error', err.message || 'Scraping failed.', 0, true);
    }
  }

  // Start Scrape
  startBtn.addEventListener('click', () => {
    const username = targetInput.value.trim().replace(/^@/, '');
    if (!username) { alert('Please enter an Instagram username.'); targetInput.focus(); return; }

    const scrapeType = typeSelect.value;
    const rawLimit = parseInt(limitInput.value, 10);
    const maxLimit = isNaN(rawLimit) || rawLimit <= 0 ? 0 : rawLimit;
    const baseDelay = parseInt(delayInput.value, 10) || 6000;

    startBtn.disabled = true;
    if (cancelBtn) { cancelBtn.style.display = ''; cancelBtn.disabled = false; }
    if (targetInput) targetInput.disabled = true;
    if (typeSelect) typeSelect.disabled = true;
    if (limitInput) limitInput.disabled = true;
    if (delayInput) delayInput.disabled = true;
    if (actionsDiv) actionsDiv.style.display = 'none';

    if (progressCard) progressCard.style.display = '';
    if (progressTarget) progressTarget.textContent = `@${username} (${scrapeType})`;
    if (progressCount) progressCount.textContent = maxLimit > 0 ? `0 / ${maxLimit} extracted` : '0 extracted';
    if (progressFill) progressFill.style.width = '0%';
    if (statusMsg) {
      statusMsg.className = 'status-message info';
      statusMsg.textContent = 'Connecting to Instagram…';
      statusMsg.style.display = 'block';
    }

    chrome.storage.local.set({ prm_ig_scraped_contacts: [] });
    runScrape(username, scrapeType, maxLimit, baseDelay);
  });

  // Cancel Scrape
  cancelBtn.addEventListener('click', () => {
    shouldCancel = true;
    cancelBtn.disabled = true;
    chrome.storage.local.get(['prm_ig_scrape_task', 'prm_ig_scraped_contacts'], (res) => {
      const task = res.prm_ig_scrape_task || {};
      const contacts = res.prm_ig_scraped_contacts || [];
      const stoppedTask = {
        ...task,
        active: false,
        status: 'warning',
        message: `Extraction stopped. (${contacts.length} collected)`,
        finishedAt: Date.now()
      };
      chrome.storage.local.set({ prm_ig_scrape_task: stoppedTask }, () => {
        refreshAudienceUI();
      });
    });
  });

  // Import to PRM
  importPrmBtn.addEventListener('click', async () => {
    const config = await getStoredConfig();
    if (!config.serverUrl || !config.sessionToken) {
      alert('PRM is not connected. Please pair the extension in Settings.');
      return;
    }

    chrome.storage.local.get(['prm_ig_scraped_contacts', 'prm_ig_scrape_task'], async (res) => {
      const contacts = res.prm_ig_scraped_contacts || [];
      if (!contacts.length) { alert('No scraped contacts found to import.'); return; }

      importPrmBtn.disabled = true;
      importPrmBtn.textContent = `Importing ${contacts.length} contacts…`;

      const task = res.prm_ig_scrape_task || {};
      const result = await bulkImportScrapedContacts(
        config.serverUrl, config.sessionToken, contacts,
        { source: 'instagram_audience_scraper', targetAccount: task.username || '', scrapeType: task.type || 'followers' }
      );

      if (result.success) {
        importPrmBtn.textContent = `✓ Imported ${contacts.length} Contacts to PRM`;
        setTimeout(() => { importPrmBtn.disabled = false; importPrmBtn.textContent = 'Import to PRM Contacts'; }, 3000);
      } else {
        alert(`Failed to import to PRM: ${result.error || 'Unknown error'}`);
        importPrmBtn.disabled = false;
        importPrmBtn.textContent = 'Import to PRM Contacts';
      }
    });
  });

  // Export CSV
  exportCsvBtn.addEventListener('click', () => {
    chrome.storage.local.get(['prm_ig_scraped_contacts', 'prm_ig_scrape_task'], (res) => {
      const contacts = res.prm_ig_scraped_contacts || [];
      if (!contacts.length) return;
      const csvHeaders = ['User ID', 'Username', 'Full Name', 'Is Private', 'Is Verified', 'Profile Pic URL'];
      const rows = contacts.map(c => [
        `"${c.id}"`, `"${(c.username || '').replace(/"/g, '""')}"`,
        `"${(c.fullName || '').replace(/"/g, '""')}"`,
        c.isPrivate ? 'true' : 'false', c.isVerified ? 'true' : 'false',
        `"${c.profilePicUrl || ''}"`,
      ]);
      const csvContent = '\uFEFF' + [csvHeaders.join(','), ...rows.map(r => r.join(','))].join('\r\n');
      const filename = `ig_${res.prm_ig_scrape_task?.username || 'audience'}_${res.prm_ig_scrape_task?.type || 'followers'}_${Date.now()}.csv`;
      downloadTxtFile(filename, csvContent, 'text/csv;charset=utf-8;');
    });
  });

  // Export JSON
  exportJsonBtn.addEventListener('click', () => {
    chrome.storage.local.get(['prm_ig_scraped_contacts', 'prm_ig_scrape_task'], (res) => {
      const contacts = res.prm_ig_scraped_contacts || [];
      if (!contacts.length) return;
      const jsonContent = JSON.stringify(contacts, null, 2);
      const filename = `ig_${res.prm_ig_scrape_task?.username || 'audience'}_${res.prm_ig_scrape_task?.type || 'followers'}_${Date.now()}.json`;
      downloadTxtFile(filename, jsonContent, 'application/json');
    });
  });
}

// ── View 3: Connected / Settings ─────────────────────────

function initConnectedView() {
  // Disconnect button
  document.getElementById('disconnect-btn')?.addEventListener('click', async () => {
    await clearConfig();
    showView('view-server-url');
    document.getElementById('server-url-input')?.focus();
  });
}

// ── TrueDB Tab Logic ────────────────────────────────────

const TPS_PATTERN = /^https?:\/\/([a-zA-Z0-9-]+\.)*truepeoplesearch\.com(\/|$)/i;

/**
 * Inspect the active tab and, when it's a TruePeopleSearch page, ask the content
 * script for the current page info to render in the TrueDB tab.
 */
async function detectTrueDbPage() {
  const pageTypeEl = document.getElementById('truedb-page-type');
  if (!pageTypeEl) return;

  const resultCountEl = document.getElementById('truedb-result-count');
  const foundCountEl = document.getElementById('truedb-found-count');
  const personNameEl = document.getElementById('truedb-person-name');
  const searchRows = document.querySelectorAll('.truedb-search-only');
  const personRows = document.querySelectorAll('.truedb-person-only');

  const showRows = (search, person) => {
    searchRows.forEach((r) => (r.style.display = search ? '' : 'none'));
    personRows.forEach((r) => (r.style.display = person ? '' : 'none'));
  };

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !isTrueDbUrl(tab.url || '')) {
      pageTypeEl.textContent = 'Not a TruePeopleSearch page';
      showRows(false, false);
      showStatus('truedb-status', 'info', 'Open a TruePeopleSearch results or person page.');
      return;
    }

    let info = null;
    try {
      info = await chrome.tabs.sendMessage(tab.id, { type: 'PRM_TPS_PAGE_INFO' });
    } catch {
      // Content script not ready yet (page still loading).
    }

    if (!info) {
      pageTypeEl.textContent = '—';
      showRows(false, false);
      showStatus('truedb-status', 'info', 'Loading page… reopen the popup if this persists.');
      return;
    }

    clearStatus('truedb-status');

    if (info.pageType === 'search') {
      pageTypeEl.textContent = 'Search Page';
      const n = info.resultCount || 0;
      resultCountEl.textContent = `${n} ${n === 1 ? 'person' : 'people'}`;
      foundCountEl.textContent = info.foundCount == null ? '—' : `${info.foundCount} found`;
      showRows(true, false);
    } else if (info.pageType === 'person') {
      pageTypeEl.textContent = 'Person Page';
      personNameEl.textContent = info.personName || '—';
      showRows(false, true);
    } else {
      pageTypeEl.textContent = 'Other TrueDB page';
      showRows(false, false);
      showStatus('truedb-status', 'info', 'Not a results or person page.');
    }
  } catch {
    pageTypeEl.textContent = 'Unable to read current tab';
    showRows(false, false);
  }
}

// ── Bootstrap ───────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // Initialise all views
  initServerUrlView();
  initCodeEntryView();
  initConnectedView();
  initTabs();
  initScraperTab();
  initAudienceTab();
  await initDarkMode();
  await debugTracker.init();
  await initDebugMode();

  // Watch for storage updates
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
      if (changes.prm_full_import_job_status) {
        updateUIWithFullImportStatus(changes.prm_full_import_job_status.newValue);
      }
      if (changes.prm_import_job_status) {
        updateUIWithJobStatus(changes.prm_import_job_status.newValue);
      }
      if (changes.prm_ig_scrape_task || changes.prm_ig_scraped_contacts) {
        refreshAudienceUI();
      }
      if (changes.prm_pending_debug_logs) {
        checkAndDownloadPendingLogs();
      }
    }
  });


  // Check for any pending debug logs immediately
  checkAndDownloadPendingLogs();

  // Determine initial view based on stored config
  const config = await getStoredConfig();

  const urlInput = document.getElementById('server-url-input');
  if (urlInput && config.serverUrl) {
    urlInput.value = config.serverUrl;
  }

  if (config.serverUrl && config.sessionToken) {
    // Fully paired → show connected view
    showView('view-connected');
    await setupContextualTabs();
  } else if (config.serverUrl) {
    // Server URL saved but not yet paired → show code entry
    const serverText = document.getElementById('code-entry-server-text');
    if (serverText) serverText.textContent = `Server: ${config.serverUrl}`;
    showView('view-code-entry');
    document.querySelector('.code-digit')?.focus();
  } else {
    // Fresh state → show server URL input
    showView('view-server-url');
    urlInput?.focus();
  }
});

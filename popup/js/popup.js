/**
 * Popup bootstrap — manages the 3-view auth flow + tabbed connected view:
 *   View 1: Server URL input (not connected)
 *   View 2: 4-digit code entry (server connected, not paired)
 *   View 3: Connected — two tabs: Scraper & Settings
 */

import { getStoredConfig, saveConfig, clearConfig, set, get, STORAGE_KEYS } from '../../utils/storage.js';
import { pingServer, verifyCode } from '../../utils/api-client.js';
import { debugTracker } from '../../utils/debug-tracker.js';

// ── DOM references ──────────────────────────────────────

const viewServerUrl = () => document.getElementById('view-server-url');
const viewCodeEntry = () => document.getElementById('view-code-entry');
const viewConnected = () => document.getElementById('view-connected');

// ── View switching & Footer state ──────────────────────

function updateConnectionFooter(isConnected, serverUrl = null) {
  const hostEl = document.getElementById('footer-connection-host');
  const dotEl = document.getElementById('footer-status-dot');
  const labelEl = document.getElementById('footer-status-label');
  if (!hostEl || !dotEl || !labelEl) return;

  if (isConnected && serverUrl) {
    try {
      const url = new URL(serverUrl);
      hostEl.textContent = `PRM (${url.hostname})`;
    } catch {
      hostEl.textContent = 'PRM Connected';
    }
    dotEl.className = 'status-dot online';
    labelEl.textContent = 'Active';
  } else {
    hostEl.textContent = 'PRM Companion';
    dotEl.className = 'status-dot';
    labelEl.textContent = 'Offline';
  }
}

async function showView(viewId) {
  document.querySelectorAll('.view').forEach((v) => {
    v.style.display = 'none';
  });
  const target = document.getElementById(viewId);
  if (target) {
    target.style.display = 'block';
  }
  const config = await getStoredConfig();
  const isConnected = viewId === 'view-connected' && Boolean(config.serverUrl && config.sessionToken);
  updateConnectionFooter(isConnected, config.serverUrl);
}

// ── Status helpers ──────────────────────────────────────

let statusTimeout = null;
function showStatus(elementId, type, message, autoDismissMs = 0) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.className = `status-message status-${type}`;
  el.textContent = message;
  el.style.display = 'block';

  if (statusTimeout) clearTimeout(statusTimeout);
  if (autoDismissMs > 0) {
    statusTimeout = setTimeout(() => clearStatus(elementId), autoDismissMs);
  }
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

    const rawUrl = input.value.trim();
    if (!rawUrl) {
      showStatus('server-url-status', 'error', 'Please enter your PRM server URL.');
      input.focus();
      return false;
    }

    // Auto-normalize (e.g. localhost:3000 -> http://localhost:3000)
    let normalized = rawUrl.replace(/\/+$/, '');
    if (!/^https?:\/\//i.test(normalized)) {
      const isLocal = /^(localhost|127\.0\.0\.1|192\.168\.|10\.|0\.0\.0\.0)(:\d+)?/i.test(normalized);
      normalized = `${isLocal ? 'http' : 'https'}://${normalized}`;
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(normalized);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Only HTTP and HTTPS protocols are supported.');
      }
    } catch {
      showStatus('server-url-status', 'error', 'Invalid server URL format. Example: https://prm.example.com');
      input.focus();
      return false;
    }

    const isLoopback = parsedUrl.hostname === 'localhost' || parsedUrl.hostname === '127.0.0.1';
    if (parsedUrl.protocol === 'http:' && !isLoopback) {
      parsedUrl.protocol = 'https:';
    }

    const finalUrl = parsedUrl.origin + (parsedUrl.pathname === '/' ? '' : parsedUrl.pathname);

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
      if (e.key === 'Backspace') {
        if (!digit.value && i > 0) {
          digits[i - 1].focus();
          digits[i - 1].value = '';
          e.preventDefault();
        }
      } else if (e.key === 'ArrowLeft' && i > 0) {
        digits[i - 1].focus();
      } else if (e.key === 'ArrowRight' && i < digits.length - 1) {
        digits[i + 1].focus();
      } else if (e.key === 'Enter') {
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

      if (!pasted) return;

      const startIdx = pasted.length === 4 ? 0 : i;
      for (let j = 0; j < pasted.length && startIdx + j < digits.length; j++) {
        digits[startIdx + j].value = pasted[j];
      }
      const nextIndex = Math.min(startIdx + pasted.length, digits.length - 1);
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

// ── Theme / Dark Mode Engine ─────────────────────────────

async function initDarkMode() {
  const toggle = document.getElementById('dark-mode-toggle');
  const quickToggle = document.getElementById('theme-quick-toggle');

  const applyTheme = (isDark) => {
    document.documentElement.classList.toggle('dark', isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    try {
      localStorage.setItem('prm_theme_cached', isDark ? 'dark' : 'light');
    } catch (_) {}
    if (toggle) toggle.checked = isDark;
    if (quickToggle) {
      quickToggle.innerHTML = isDark
        ? `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`
        : `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>`;
      quickToggle.title = isDark ? 'Switch to Light appearance' : 'Switch to Dark appearance';
    }
  };

  // Load stored preference; default to dark mode
  const storedTheme = await get(STORAGE_KEYS.DARK_MODE);
  const isDark = storedTheme === null ? true : storedTheme === 'dark';
  applyTheme(isDark);

  const toggleTheme = async (newDark) => {
    applyTheme(newDark);
    await set(STORAGE_KEYS.DARK_MODE, newDark ? 'dark' : 'light');
  };

  if (toggle) {
    toggle.addEventListener('change', () => {
      toggleTheme(toggle.checked);
    });
  }

  if (quickToggle) {
    quickToggle.addEventListener('click', () => {
      const currentlyDark = document.documentElement.classList.contains('dark');
      toggleTheme(!currentlyDark);
    });
  }
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
async function downloadTxtFile(filename, text, mimeType = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mimeType });
  const blobUrl = URL.createObjectURL(blob);

  if (chrome.downloads && chrome.downloads.download) {
    try {
      await chrome.downloads.download({
        url: blobUrl,
        filename,
        saveAs: false,
      });
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
      return;
    } catch {
      // Fall through to anchor tag click
    }
  }

  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
}

// ── Instagram URL matching (mirrors url-matcher.js) ─────

const NON_PROFILE_PATHS = ['p', 'reel', 'stories', 'explore', 'accounts', 'direct', 'reels', 'about', 'legal', 'privacy', 'terms', 'tv'];

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
      platformBadge.style.display = 'none';
      return;
    }

    urlText.textContent = tab.url;

    const { isProfile, username } = checkInstagramProfile(tab.url);

    if (isProfile && username) {
      platformBadge.style.display = '';
      platformName.textContent = `Instagram · @${username}`;
      if (importPostsBtn) importPostsBtn.style.display = '';
      if (importLatestPostBtn) importLatestPostBtn.style.display = '';
    } else {
      platformBadge.style.display = 'none';
      if (importPostsBtn) importPostsBtn.style.display = 'none';
      if (importLatestPostBtn) importLatestPostBtn.style.display = 'none';
    }

    chrome.storage.local.get(['prm_import_job_status'], (res) => {
      updateUIWithJobStatus(res.prm_import_job_status);
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
    platformBadge.style.display = 'none';
  }
}

function updateUIWithJobStatus(jobStatus) {
  const scrapeBtn = document.getElementById('scrape-btn');
  const importPostsBtn = document.getElementById('import-posts-btn');
  const importLatestPostBtn = document.getElementById('import-latest-post-btn');
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
    showStatus('scrape-status', jobStatus.status, jobStatus.message);
  } else {
    if (importPostsBtn) {
      restoreButtonHtml(importPostsBtn, 'Import Posts to PRM');
    }
    if (importLatestPostBtn) {
      restoreButtonHtml(importLatestPostBtn, 'Add Most Recent Post to PRM');
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

      if (jobStatus && isProfile && username && username === jobStatus.username) {
        showStatus('scrape-status', jobStatus.status, jobStatus.message);
      } else {
        clearStatus('scrape-status');
      }
    });
  }
}

function restoreButtonHtml(btn, label) {
  const existingSvg = btn.querySelector('svg');
  if (existingSvg) {
    const textNode = Array.from(btn.childNodes).find((n) => n.nodeType === Node.TEXT_NODE);
    if (textNode) {
      textNode.textContent = ` ${label}`;
    } else {
      btn.appendChild(document.createTextNode(` ${label}`));
    }
    return;
  }
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
}


let refreshAudienceUI = () => {};

// ── Audience / Account Extraction Tab Logic ────────────────

function initAudienceTab() {
  const usernameDisplay = document.getElementById('audience-username-text');
  const extractionType = document.getElementById('audience-extraction-type');
  const startBtn = document.getElementById('audience-start-btn');
  const cancelBtn = document.getElementById('audience-cancel-btn');
  const statusCard = document.getElementById('audience-status-card');
  const statusMsg = document.getElementById('audience-status-msg');
  const previewFields = document.getElementById('audience-preview-fields');
  const previewUsername = document.getElementById('audience-preview-username');
  const previewName = document.getElementById('audience-preview-name');
  const previewBio = document.getElementById('audience-preview-bio');
  const previewWebsite = document.getElementById('audience-preview-website');
  const logConsole = document.getElementById('audience-log-console');
  const clearLogsBtn = document.getElementById('audience-clear-logs-btn');

  if (!startBtn) return;

  const MAX_LOG_LINES = 200;
  function addLog(text) {
    if (!logConsole) return;
    const time = new Date().toLocaleTimeString();
    const newLine = `[${time}] ${text}\n`;
    let current = logConsole.textContent + newLine;
    const lines = current.split('\n');
    if (lines.length > MAX_LOG_LINES) {
      current = lines.slice(lines.length - MAX_LOG_LINES).join('\n');
    }
    logConsole.textContent = current;
    logConsole.scrollTop = logConsole.scrollHeight;
  }

  if (clearLogsBtn) {
    clearLogsBtn.addEventListener('click', () => {
      if (logConsole) logConsole.textContent = '';
    });
  }

  function extractIgUsername(url) {
    const match = (url || '').match(/^https?:\/\/(www\.)?instagram\.com\/([a-zA-Z0-9_.]+)\/?(?:[?#].*)?$/);
    if (match && !['p', 'explore', 'reels', 'stories', 'direct', 'accounts', 'about', 'tv', 'reel'].includes(match[2])) {
      return match[2];
    }
    return null;
  }

  let detectedUsername = null;

  async function detectUsername() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      detectedUsername = tab?.url ? extractIgUsername(tab.url) : null;
    } catch { detectedUsername = null; }

    if (detectedUsername) {
      usernameDisplay.textContent = `@${detectedUsername}`;
      startBtn.disabled = false;
    } else {
      usernameDisplay.textContent = 'Navigate to an Instagram profile';
      startBtn.disabled = true;
    }
  }

  function showAudienceStatus(status, msg) {
    if (statusCard) statusCard.style.display = '';
    if (statusMsg) {
      statusMsg.className = `status-message status-message-${status}`;
      statusMsg.textContent = msg;
    }
  }

  function showPreview(data) {
    if (!previewFields) return;
    previewFields.style.display = '';
    if (previewUsername) previewUsername.textContent = data.username ? `@${data.username}` : '—';
    if (previewName) previewName.textContent = data.name || '—';
    if (previewBio) previewBio.textContent = data.bio || '—';
    if (previewWebsite) previewWebsite.textContent = data.website || '—';
  }

  // Extraction runs in the background worker, which opens the profile in its
  // own tab and posts the result to PRM. The popup is just a client of it, so
  // closing this window no longer abandons a run in progress.
  startBtn.addEventListener('click', async () => {
    if (!detectedUsername) return;

    statusCard.style.display = '';
    addLog(`=== Starting extraction for @${detectedUsername} ===`);
    startBtn.disabled = true;

    const refuse = (msg) => {
      addLog(`✗ ${msg}`);
      showAudienceStatus('error', msg);
      startBtn.disabled = false;
    };

    const action = extractionType.value === 'account' ? 'account' : 'graph';

    let response;
    try {
      response = await chrome.runtime.sendMessage({
        type: 'PRM_EXTRACT_START',
        action,
        username: detectedUsername,
      });
    } catch {
      refuse('The background worker is not running. Reload the extension at chrome://extensions.');
      return;
    }

    // A reply of undefined means listeners were present but none handled the
    // message — the worker is still running a build from before this feature.
    // The popup reloads from disk on every open, so it can easily be newer.
    if (response === undefined) {
      refuse('The background worker is running an older build. Reload the extension at chrome://extensions.');
      return;
    }

    if (!response.ok) {
      refuse(response.reason === 'not_paired'
        ? 'PRM is not connected. Please pair the extension in Settings.'
        : `Could not start extraction (${response.reason}).`);
      return;
    }

    cancelBtn.style.display = '';
    cancelBtn.disabled = false;
  });

  cancelBtn.onclick = async () => {
    cancelBtn.disabled = true;
    addLog('⚠ Cancellation requested by user.');
    await chrome.runtime.sendMessage({ type: 'PRM_EXTRACT_CANCEL' });
  };

  /** Mirror the worker's job status into the log, the banner, and the preview. */
  function renderExtractStatus(state) {
    if (!state) return;

    statusCard.style.display = '';
    addLog(state.message);
    showAudienceStatus(state.status, state.message);

    if (state.preview) showPreview(state.preview);

    startBtn.disabled = state.active || !detectedUsername;
    cancelBtn.style.display = state.active ? '' : 'none';
  }

  chrome.storage.local.get(['prm_extract_status'], (res) => renderExtractStatus(res.prm_extract_status));
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.prm_extract_status) {
      renderExtractStatus(changes.prm_extract_status.newValue);
    }
  });

  refreshAudienceUI = detectUsername;
  detectUsername();
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
      if (changes.prm_import_job_status) {
        updateUIWithJobStatus(changes.prm_import_job_status.newValue);
      }
      if (changes.prm_pending_debug_logs && Array.isArray(changes.prm_pending_debug_logs.newValue) && changes.prm_pending_debug_logs.newValue.length > 0) {
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

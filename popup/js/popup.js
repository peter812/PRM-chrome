/**
 * Popup bootstrap — manages the 3-view auth flow + tabbed connected view:
 *   View 1: Server URL input (not connected)
 *   View 2: 4-digit code entry (server connected, not paired)
 *   View 3: Connected — two tabs: Scraper & Settings
 */

import { getStoredConfig, saveConfig, clearConfig, set, get, STORAGE_KEYS } from '../../utils/storage.js';
import { pingServer, verifyCode } from '../../utils/api-client.js';

// ── DOM references ──────────────────────────────────────

const viewServerUrl = () => document.getElementById('view-server-url');
const viewCodeEntry = () => document.getElementById('view-code-entry');
const viewConnected = () => document.getElementById('view-connected');

// ── View switching ──────────────────────────────────────

function showView(viewId) {
  document.querySelectorAll('.view').forEach((v) => (v.style.display = 'none'));
  const target = document.getElementById(viewId);
  if (target) target.style.display = '';
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
  el.style.display = '';
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
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearStatus('server-url-status');

    const input = document.getElementById('server-url-input');
    const serverUrl = input.value.trim().replace(/\/+$/, '');
    if (!serverUrl) return;

    const btn = document.getElementById('connect-btn');
    btn.disabled = true;
    btn.textContent = 'Connecting…';

    const online = await pingServer(serverUrl);

    if (online) {
      await set(STORAGE_KEYS.SERVER_URL, serverUrl);
      showView('view-code-entry');
      document.querySelector('.code-digit')?.focus();
    } else {
      showStatus('server-url-status', 'error', 'Could not connect to PRM server. Check the URL and try again.');
    }

    btn.disabled = false;
    btn.textContent = 'Connect';
  });
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
    verifyBtn.disabled = code.length !== 4;
  }

  function clearDigits() {
    digits.forEach((d) => (d.value = ''));
    digits[0]?.focus();
    updateVerifyBtn();
  }

  // Auto-advance on input, only accept digits
  digits.forEach((digit, i) => {
    digit.addEventListener('input', () => {
      // Only keep the last digit character
      digit.value = digit.value.replace(/[^0-9]/g, '').slice(-1);

      if (digit.value && i < digits.length - 1) {
        digits[i + 1].focus();
      }
      updateVerifyBtn();
    });

    digit.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !digit.value && i > 0) {
        digits[i - 1].focus();
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
    });
  });

  // Submit code
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearStatus('code-entry-status');

    const code = getCode();
    if (code.length !== 4) return;

    verifyBtn.disabled = true;
    verifyBtn.textContent = 'Verifying…';

    const { serverUrl } = await getStoredConfig();
    const result = await verifyCode(serverUrl, code);

    if (result.success) {
      await saveConfig(serverUrl, result.sessionToken, result.sessionId);
      showView('view-connected');
      detectCurrentPage();
    } else {
      showStatus(
        'code-entry-status',
        'error',
        result.error || 'Invalid or expired code. Get a new code from PRM settings.',
      );
      clearDigits();
    }

    verifyBtn.disabled = false;
    verifyBtn.textContent = 'Verify';
    updateVerifyBtn();
  });

  // Change server URL link
  document.getElementById('change-server-btn')?.addEventListener('click', async () => {
    await clearConfig();
    showView('view-server-url');
    document.getElementById('server-url-input')?.focus();
  });
}

// ── Tab switching ───────────────────────────────────────

function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-btn');

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.tab;
      if (!targetId) return;

      // Update button states
      tabButtons.forEach((b) => {
        b.classList.remove('tab-active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('tab-active');
      btn.setAttribute('aria-selected', 'true');

      // Update panel visibility
      document.querySelectorAll('.tab-panel').forEach((p) => (p.style.display = 'none'));
      const panel = document.getElementById(targetId);
      if (panel) panel.style.display = '';
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

// ── Instagram URL matching (mirrors url-matcher.js) ─────

const INSTAGRAM_PATTERN = /^https?:\/\/(www\.)?instagram\.com\//i;
const NON_PROFILE_PATHS = ['p', 'reel', 'stories', 'explore', 'accounts', 'direct', 'reels'];

/**
 * Check if a URL is an Instagram profile page.
 * @param {string} url
 * @returns {{ isProfile: boolean, username: string|null }}
 */
function checkInstagramProfile(url) {
  if (!INSTAGRAM_PATTERN.test(url)) return { isProfile: false, username: null };

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

// ── Scraper Tab Logic ───────────────────────────────────

/**
 * Detect the current tab's URL and update the scraper UI.
 */
async function detectCurrentPage() {
  const urlText = document.getElementById('current-url-text');
  const platformBadge = document.getElementById('scraper-platform-badge');
  const platformName = document.getElementById('scraper-platform-name');
  const scrapeBtn = document.getElementById('scrape-btn');

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.url) {
      urlText.textContent = 'No page detected';
      scrapeBtn.disabled = true;
      platformBadge.style.display = 'none';
      return;
    }

    urlText.textContent = tab.url;

    const { isProfile, username } = checkInstagramProfile(tab.url);

    if (isProfile && username) {
      platformBadge.style.display = '';
      platformName.textContent = `Instagram · @${escapeHtml(username)}`;
      scrapeBtn.disabled = false;
    } else {
      platformBadge.style.display = 'none';
      scrapeBtn.disabled = true;
    }
  } catch {
    urlText.textContent = 'Unable to read current tab';
    scrapeBtn.disabled = true;
    platformBadge.style.display = 'none';
  }
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
  if (!scrapeBtn) return;

  scrapeBtn.addEventListener('click', async () => {
    clearStatus('scrape-status');
    scrapeBtn.disabled = true;
    scrapeBtn.textContent = 'Scraping…';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) {
        showStatus('scrape-status', 'error', 'No active tab found.');
        return;
      }

      // Inject content script if not already present, then send extraction message
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/scraper.js'],
        });
      } catch {
        // Script may already be injected — proceed
      }

      // Wait briefly for the content script to initialize
      await new Promise((resolve) => setTimeout(resolve, 500));

      const response = await chrome.tabs.sendMessage(tab.id, {
        type: 'PRM_EXTRACT',
        platform: 'Instagram',
      });

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

      // Re-check if button should be enabled
      const { isProfile } = checkInstagramProfile(
        document.getElementById('current-url-text')?.textContent || ''
      );
      scrapeBtn.disabled = !isProfile;
    }
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

// ── Bootstrap ───────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  // Initialise all views
  initServerUrlView();
  initCodeEntryView();
  initConnectedView();
  initTabs();
  initScraperTab();
  await initDarkMode();

  // Determine initial view based on stored config
  const config = await getStoredConfig();

  if (config.serverUrl && config.sessionToken) {
    // Fully paired → show connected view
    showView('view-connected');
    detectCurrentPage();
  } else if (config.serverUrl) {
    // Server URL saved but not yet paired → show code entry
    showView('view-code-entry');
    document.querySelector('.code-digit')?.focus();
  } else {
    // Fresh state → show server URL input
    showView('view-server-url');
    document.getElementById('server-url-input')?.focus();
  }
});

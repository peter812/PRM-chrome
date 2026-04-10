/**
 * Popup bootstrap — manages the 3-view auth flow:
 *   View 1: Server URL input (not connected)
 *   View 2: 4-digit code entry (server connected, not paired)
 *   View 3: Connected / Search (paired)
 */

import { getStoredConfig, saveConfig, clearConfig, set, STORAGE_KEYS } from '../../utils/storage.js';
import { pingServer, verifyCode, searchPeople } from '../../utils/api-client.js';

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
      document.getElementById('search-input')?.focus();
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

// ── View 3: Connected / Search ─────────────────────────

function initConnectedView() {
  const searchInput = document.getElementById('search-input');
  const resultsContainer = document.getElementById('search-results');
  let debounceTimer = null;

  function renderResults(results) {
    if (!results || results.length === 0) {
      resultsContainer.innerHTML =
        '<p class="search-empty">No contacts found.</p>';
      return;
    }

    resultsContainer.innerHTML = results
      .map((person) => {
        const name = escapeHtml(
          [person.firstName, person.lastName].filter(Boolean).join(' ') ||
            person.name ||
            'Unknown',
        );
        const company = person.company
          ? `<span class="result-company">${escapeHtml(person.company)}</span>`
          : '';
        const email = person.email
          ? `<span class="result-email">${escapeHtml(person.email)}</span>`
          : '';

        return `
          <a class="search-result-item" href="#" data-person-id="${escapeHtml(String(person.id || ''))}">
            <div class="result-avatar">${escapeHtml(name.charAt(0).toUpperCase())}</div>
            <div class="result-info">
              <span class="result-name">${name}</span>
              ${company}
              ${email}
            </div>
          </a>
        `;
      })
      .join('');

    // Click to open person page in new tab
    resultsContainer.querySelectorAll('.search-result-item').forEach((item) => {
      item.addEventListener('click', async (e) => {
        e.preventDefault();
        const personId = item.dataset.personId;
        if (personId && /^[\w-]+$/.test(personId)) {
          const { serverUrl } = await getStoredConfig();
          const url = `${serverUrl}/person/${encodeURIComponent(personId)}`;
          chrome.tabs.create({ url });
        }
      });
    });
  }

  searchInput?.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const query = searchInput.value.trim();

    if (!query) {
      resultsContainer.innerHTML = '';
      return;
    }

    debounceTimer = setTimeout(async () => {
      resultsContainer.innerHTML = '<p class="search-loading">Searching…</p>';

      const { serverUrl, sessionToken } = await getStoredConfig();
      const result = await searchPeople(serverUrl, sessionToken, query);

      if (result.success) {
        renderResults(result.results);
      } else {
        resultsContainer.innerHTML = `<p class="search-error">${escapeHtml(result.error)}</p>`;
      }
    }, 300);
  });

  // Disconnect button
  document.getElementById('disconnect-btn')?.addEventListener('click', async () => {
    await clearConfig();
    resultsContainer.innerHTML = '';
    if (searchInput) searchInput.value = '';
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

  // Determine initial view based on stored config
  const config = await getStoredConfig();

  if (config.serverUrl && config.sessionToken) {
    // Fully paired → show connected view
    showView('view-connected');
    document.getElementById('search-input')?.focus();
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

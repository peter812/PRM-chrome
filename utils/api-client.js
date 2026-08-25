/**
 * API client for communicating with the PRM backend.
 *
 * Uses the 4-digit pairing code auth flow:
 *   1. pingServer — health check (no auth)
 *   2. verifyCode — exchange 4-digit code for session token
 *   3. pingSession — keep session alive / validate
 *   4. searchPeople — search contacts with session token
 *
 * All fetch calls use AbortController with a 10-second timeout and return
 * structured results instead of throwing exceptions.
 */

/** Default timeout for API requests in milliseconds. */
const REQUEST_TIMEOUT_MS = 10_000;

/** Shorter timeout for the server ping (health check). */
const PING_TIMEOUT_MS = 5_000;

/**
 * Helper: fetch with an AbortController timeout.
 * @param {string} url
 * @param {RequestInit} options
 * @param {number} [timeoutMs]
 * @returns {Promise<Response>}
 */
function fetchWithTimeout(url, options = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  return fetch(url, { ...options, signal: controller.signal }).finally(() => {
    clearTimeout(timer);
  });
}

/**
 * Normalize a server URL, automatically adding http:// or https:// if omitted.
 * @param {string} url
 * @returns {string}
 */
function normalizeUrl(url) {
  let trimmed = String(url || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) {
    const isLoopback = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(trimmed);
    trimmed = isLoopback ? `http://${trimmed}` : `https://${trimmed}`;
  }
  try {
    const parsed = new URL(trimmed);
    const isLoopback = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (parsed.protocol === 'http:' && !isLoopback) {
      parsed.protocol = 'https:';
    }
    return parsed.toString().replace(/\/+$/, '');
  } catch {
    return trimmed;
  }
}

/**
 * Ping the PRM server to check it is online.
 * Probes `/api/v1/ping` with fallback to common ping paths.
 *
 * @param {string} serverUrl — base URL of the PRM server
 * @returns {Promise<{ ok: boolean, normalizedUrl: string, error?: string }>}
 */
async function pingServer(serverUrl) {
  const normalized = normalizeUrl(serverUrl);
  if (!normalized) {
    return { ok: false, normalizedUrl: '', error: 'Please enter a valid server URL.' };
  }

  const endpoints = ['/api/v1/ping', '/api/ping', '/ping', '/api/extension-auth/ping', ''];
  let lastError = null;

  for (const endpoint of endpoints) {
    const url = `${normalized}${endpoint}`;
    try {
      const res = await fetchWithTimeout(url, { method: 'GET' }, PING_TIMEOUT_MS);
      if (res.ok || (res.status === 401 && endpoint === '/api/extension-auth/ping')) {
        return { ok: true, normalizedUrl: normalized };
      }
      lastError = `Server returned HTTP ${res.status} on ${endpoint || '/'}`;
    } catch (err) {
      if (err.name === 'AbortError') {
        lastError = 'Connection timed out (5s). Is the server running?';
      } else {
        lastError = err.message || 'Cannot reach server';
      }
    }
  }

  return {
    ok: false,
    normalizedUrl: normalized,
    error: lastError || 'Could not connect to server. Check the URL and network.'
  };
}

/**
 * Verify a 4-digit pairing code with the PRM server.
 * `POST {serverUrl}/api/extension-auth/verify`
 *
 * @param {string} serverUrl
 * @param {string} code — 4-digit code
 * @returns {Promise<{ success: boolean, sessionToken?: string, sessionId?: string, createdAt?: string, error?: string }>}
 */
async function verifyCode(serverUrl, code) {
  const url = `${serverUrl.replace(/\/+$/, '')}/api/extension-auth/verify`;
  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    const data = await res.json();

    if (res.status === 201 || res.ok) {
      return {
        success: true,
        sessionToken: data.sessionToken,
        sessionId: data.sessionId,
        createdAt: data.createdAt,
      };
    }

    return { success: false, error: data.error || 'Invalid or expired code' };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Request timed out. Check your connection.' };
    }
    return { success: false, error: 'Cannot connect to server. Check the URL and try again.' };
  }
}

/**
 * Ping an active session to keep it alive.
 * `POST {serverUrl}/api/extension-auth/ping`
 *
 * @param {string} serverUrl
 * @param {string} token — session token
 * @returns {Promise<boolean>} — true if session is still valid
 */
async function pingSession(serverUrl, token) {
  const url = `${serverUrl.replace(/\/+$/, '')}/api/extension-auth/ping`;
  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'X-Extension-Token': token },
    });
    return { ok: res.ok, status: res.status };
  } catch {
    return { ok: false, status: 0, isNetworkError: true };
  }
}

/**
 * Search contacts in PRM.
 * `GET {serverUrl}/api/search?q={query}`
 *
 * @param {string} serverUrl
 * @param {string} token — session token
 * @param {string} query — search query
 * @returns {Promise<{ success: boolean, results?: Array, error?: string }>}
 */
async function searchPeople(serverUrl, token, query) {
  const url = `${serverUrl.replace(/\/+$/, '')}/api/search?q=${encodeURIComponent(query)}`;
  try {
    const res = await fetchWithTimeout(url, {
      method: 'GET',
      headers: { 'X-Extension-Token': token },
    });

    if (res.status === 401) {
      return { success: false, error: 'Session expired. Please reconnect.' };
    }

    if (!res.ok) {
      return { success: false, error: `Server error (${res.status}). Please try again later.` };
    }

    const data = await res.json();
    const results = Array.isArray(data) ? data : data.results || [];
    return { success: true, results };
  } catch (err) {
    if (err.name === 'AbortError') {
      return { success: false, error: 'Search request timed out.' };
    }
    return { success: false, error: 'Cannot connect to server. Check your connection.' };
  }
}

/**
 * Send bulk scraped contacts to PRM server.
 * `POST {serverUrl}/api/v1/scrape-results` or `POST /api/v1/contacts/bulk-import`
 *
 * @param {string} serverUrl
 * @param {string} token
 * @param {Array<Object>} contacts
 * @param {Object} [meta]
 * @returns {Promise<{ success: boolean, count?: number, error?: string }>}
 */
async function bulkImportScrapedContacts(serverUrl, token, contacts, meta = {}) {
  const url = `${serverUrl.replace(/\/+$/, '')}/api/v1/scrape-results`;
  try {
    const payload = {
      platform: 'Instagram',
      type: 'bulk_scrape',
      source: meta.source || 'followers_scraper',
      targetAccount: meta.targetAccount || '',
      contacts: contacts.map(c => ({
        platform: 'Instagram',
        username: c.username,
        name: c.fullName || c.name || c.username,
        avatarUrl: c.profilePicUrl || c.avatarUrl || '',
        isVerified: !!c.isVerified,
        isPrivate: !!c.isPrivate,
        url: `https://instagram.com/${c.username}`,
        notes: meta.targetAccount ? `Scraped from @${meta.targetAccount} (${meta.scrapeType || 'followers'})` : 'Scraped via PRM',
      })),
      timestamp: Date.now()
    };

    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-Token': token,
      },
      body: JSON.stringify(payload),
    }, 30_000);

    if (res.status === 401) {
      return { success: false, error: 'Session expired. Please reconnect.' };
    }

    if (!res.ok) {
      return { success: false, error: `Server error (${res.status}).` };
    }

    return { success: true, count: contacts.length };
  } catch (err) {
    return { success: false, error: err.name === 'AbortError' ? 'Request timed out.' : 'Network error.' };
  }
}

/**
 * Send full pending account import payload to PRM server.
 * `POST {serverUrl}/api/v1/pending-imports`
 *
 * @param {string} serverUrl
 * @param {string} token
 * @param {Object} payload
 * @returns {Promise<{ success: boolean, id?: string, error?: string }>}
 */
async function sendPendingImport(serverUrl, token, payload) {
  const url = `${serverUrl.replace(/\/+$/, '')}/api/v1/pending-imports`;
  try {
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-Token': token,
      },
      body: JSON.stringify(payload),
    }, 60_000);

    if (res.status === 401) {
      return { success: false, error: 'Session expired. Please reconnect PRM.' };
    }

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { success: false, error: errData.error || `Server error (${res.status}).` };
    }

    const data = await res.json().catch(() => ({}));
    return { success: true, id: data.id || payload.uuid };
  } catch (err) {
    return { success: false, error: err.name === 'AbortError' ? 'Request timed out.' : 'Network error.' };
  }
}

export { pingServer, verifyCode, pingSession, searchPeople, bulkImportScrapedContacts, sendPendingImport };



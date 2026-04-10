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
 * Ping the PRM server to check it is online.
 * `GET {serverUrl}/api/v1/ping`
 *
 * @param {string} serverUrl — base URL of the PRM server
 * @returns {Promise<boolean>} — true if server responds with status "ok"
 */
async function pingServer(serverUrl) {
  const url = `${serverUrl.replace(/\/+$/, '')}/api/v1/ping`;
  try {
    const res = await fetchWithTimeout(url, { method: 'GET' }, PING_TIMEOUT_MS);
    if (!res.ok) return false;
    const data = await res.json();
    return data.status === 'ok';
  } catch {
    return false;
  }
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
    return res.ok;
  } catch {
    return false;
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
      return { success: false, error: 'Request timed out. Check your connection.' };
    }
    return { success: false, error: 'Network error. Check your connection.' };
  }
}

export { pingServer, verifyCode, pingSession, searchPeople };

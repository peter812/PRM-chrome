/**
 * API client for communicating with the PRM backend.
 */

import { STORAGE_KEYS, get } from './storage.js';

/** Default maximum retry attempts. */
const MAX_RETRIES = 3;

/** Base delay in ms for exponential back-off. */
const BASE_DELAY_MS = 500;

/**
 * Build the full endpoint URL from the stored base URL.
 * @param {string} path – e.g. "/api/v1/ping"
 * @returns {Promise<string>}
 */
async function buildUrl(path) {
  const base = await get(STORAGE_KEYS.API_URL);
  if (!base) throw new Error('API URL is not configured.');
  // Strip trailing slash from base, ensure path starts with /
  const cleanBase = base.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

/**
 * Return default headers including the API key.
 * @returns {Promise<Record<string, string>>}
 */
async function defaultHeaders() {
  const apiKey = await get(STORAGE_KEYS.API_KEY);
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }
  return headers;
}

/**
 * Fetch with exponential back-off retry.
 * @param {string} url
 * @param {RequestInit} options
 * @param {number} [maxRetries]
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options, maxRetries = MAX_RETRIES) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return res;
      // Don't retry client errors (4xx) except 429 (rate limit)
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        throw new Error(`API error: ${res.status} ${res.statusText}`);
      }
      lastError = new Error(`API error: ${res.status} ${res.statusText}`);
    } catch (err) {
      lastError = err;
      // Re-throw client errors immediately
      if (err.message && err.message.startsWith('API error: 4')) {
        throw err;
      }
    }
    // Exponential back-off: 500ms, 1s, 2s, …
    if (attempt < maxRetries) {
      await new Promise((r) => setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt)));
    }
  }
  throw lastError;
}

/**
 * Perform a health-check / auth-validation request.
 * Resolves to `true` if the server responds with a 2xx status.
 * @param {string} apiUrl – full base URL to test
 * @param {string} apiKey – API key to test
 * @returns {Promise<boolean>}
 */
async function ping(apiUrl, apiKey) {
  const url = `${apiUrl.replace(/\/+$/, '')}/api/v1/ping`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Fetch PRM information for a given page URL.
 * Uses retry with exponential back-off.
 * @param {string} pageUrl – the URL of the page the user is viewing
 * @returns {Promise<object>} – parsed JSON body
 */
async function getUrlInfo(pageUrl) {
  const url = await buildUrl('/api/v1/url-info');
  const headers = await defaultHeaders();
  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ url: pageUrl }),
  });
  return res.json();
}

/**
 * Post scraped results to the API.
 * Uses retry with exponential back-off.
 * @param {object} result – { url, platform, data, timestamp }
 * @returns {Promise<object>}
 */
async function postScrapeResults(result) {
  const url = await buildUrl('/api/v1/scrape-results');
  const headers = await defaultHeaders();
  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(result),
  });
  return res.json();
}

/**
 * Fetch the URL allow-list from the API.
 * @returns {Promise<object>}
 */
async function fetchUrlList() {
  const url = await buildUrl('/api/v1/url-list');
  const headers = await defaultHeaders();
  const res = await fetchWithRetry(url, {
    method: 'GET',
    headers,
  });
  return res.json();
}

/**
 * Search PRM social accounts by username.
 * Uses retry with exponential back-off.
 * @param {string} username – the social media username to search for
 * @param {string} [platform] – optional platform filter (e.g. "Instagram")
 * @returns {Promise<object>} – parsed JSON body with social account results
 */
async function searchSocialAccounts(username, platform) {
  const url = await buildUrl('/api/v1/social-accounts/search');
  const headers = await defaultHeaders();
  const body = { username };
  if (platform) {
    body.platform = platform;
  }
  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  return res.json();
}

export { ping, getUrlInfo, postScrapeResults, fetchUrlList, searchSocialAccounts };

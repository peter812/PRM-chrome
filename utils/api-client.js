/**
 * API client for communicating with the PRM backend.
 */

import { STORAGE_KEYS, get } from './storage.js';

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
 * Perform a health-check / auth-validation request.
 * Resolves to `true` if the server responds with a 2xx status.
 * @param {string} apiUrl – full base URL to test
 * @param {string} apiKey – API key to test
 * @returns {Promise<boolean>}
 */
async function ping(apiUrl, apiKey) {
  const url = `${apiUrl.replace(/\/+$/, '')}/api/v1/ping`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
  });
  return res.ok;
}

/**
 * Fetch PRM information for a given page URL.
 * @param {string} pageUrl – the URL of the page the user is viewing
 * @returns {Promise<object>} – parsed JSON body
 */
async function getUrlInfo(pageUrl) {
  const url = await buildUrl('/api/v1/url-info');
  const headers = await defaultHeaders();
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ url: pageUrl }),
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export { ping, getUrlInfo };

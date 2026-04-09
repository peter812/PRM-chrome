/**
 * Background service worker for PRM Chrome Extension.
 *
 * Listens for tab updates and messages from the popup / content scripts.
 */

chrome.runtime.onInstalled.addListener(() => {
  // eslint-disable-next-line no-console
  console.log('PRM Chrome Extension installed.');
});

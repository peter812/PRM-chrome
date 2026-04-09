/**
 * Content script — Scraping engine.
 *
 * Injected programmatically by the service worker on matched URLs.
 * Uses a pluggable extraction interface so new selectors / rules
 * can be added without changing core logic.
 *
 * Communication:
 *   service-worker  ──▶  scraper.js (via chrome.scripting.executeScript)
 *   scraper.js      ──▶  service-worker (via chrome.runtime.sendMessage)
 */

/* eslint-disable no-console */

/**
 * Platform-specific extraction rules.
 *
 * Each entry maps a platform name to an extraction function that
 * returns a data object (or null if nothing useful was found).
 * These will be populated as scraping targets are defined.
 *
 * @type {Record<string, () => object|null>}
 */
const EXTRACTORS = {
  /**
   * Instagram profile extractor (placeholder selectors — to be finalised).
   */
  Instagram: () => {
    try {
      const nameEl = document.querySelector('header h2, header h1');
      const bioEl = document.querySelector('header section > div.-vDIg span, header section span[class]');
      const stats = document.querySelectorAll('header section ul li span span');

      return {
        username: nameEl ? nameEl.textContent.trim() : null,
        bio: bioEl ? bioEl.textContent.trim() : null,
        posts: stats[0] ? stats[0].textContent.trim() : null,
        followers: stats[1] ? stats[1].textContent.trim() : null,
        following: stats[2] ? stats[2].textContent.trim() : null,
      };
    } catch {
      return null;
    }
  },

  /**
   * LinkedIn profile extractor (placeholder selectors).
   */
  LinkedIn: () => {
    try {
      const nameEl = document.querySelector('.text-heading-xlarge, h1.top-card-layout__title');
      const headlineEl = document.querySelector('.text-body-medium, .top-card-layout__headline');
      const locationEl = document.querySelector('.text-body-small .inline-show-more-text, .top-card__subline-item');

      return {
        name: nameEl ? nameEl.textContent.trim() : null,
        headline: headlineEl ? headlineEl.textContent.trim() : null,
        location: locationEl ? locationEl.textContent.trim() : null,
      };
    } catch {
      return null;
    }
  },

  /**
   * Facebook profile extractor (placeholder selectors).
   */
  Facebook: () => {
    try {
      const nameEl = document.querySelector('h1');
      return {
        name: nameEl ? nameEl.textContent.trim() : null,
      };
    } catch {
      return null;
    }
  },

  /**
   * VSCO profile extractor (placeholder selectors).
   */
  VSCO: () => {
    try {
      const nameEl = document.querySelector('.user-name, [class*="UserName"]');
      const bioEl = document.querySelector('.user-bio, [class*="UserBio"]');
      return {
        username: nameEl ? nameEl.textContent.trim() : null,
        bio: bioEl ? bioEl.textContent.trim() : null,
      };
    } catch {
      return null;
    }
  },
};

/**
 * Run the extraction for a given platform.
 * @param {string} platform – platform name matching a key in EXTRACTORS
 * @returns {object|null}
 */
function extract(platform) {
  const extractor = EXTRACTORS[platform];
  if (!extractor) {
    console.warn(`[PRM] No extractor defined for platform: ${platform}`);
    return null;
  }
  return extractor();
}

/**
 * Main entry point — called when the script is injected.
 * Listens for extraction requests from the service worker.
 */
function init() {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'PRM_EXTRACT') {
      const platform = message.platform;
      const data = extract(platform);

      sendResponse({
        success: data !== null,
        platform,
        url: window.location.href,
        data,
        timestamp: new Date().toISOString(),
      });
    }
    // Return true to indicate async response
    return true;
  });

  console.log('[PRM] Content script loaded — ready for extraction requests.');
}

init();

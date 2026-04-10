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
 * Decode HTML entities in a string (e.g. &#064; → @, &quot; → ").
 * @param {string} str
 * @returns {string}
 */
function decodeHtmlEntities(str) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = str;
  return textarea.value;
}

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
   * Instagram profile extractor.
   *
   * Uses stable SEO meta tags instead of obfuscated DOM class names.
   * - Username & Display Name: from <title> or <meta property="og:title">
   * - Followers & Following: from <meta name="description"> / og:description
   * - Bio: text inside quotes in the description meta tag
   * - Bio Link: DOM scan for external links inside <header>
   */
  Instagram: () => {
    try {
      let username = null;
      let displayName = null;
      let followers = null;
      let following = null;
      let bio = null;
      let bioLink = null;

      // --- Username & Display Name from <title> ---
      const titleText = decodeHtmlEntities(document.title || '');
      // Pattern: "Display Name (@username) • Instagram photos and videos"
      const titleMatch = titleText.match(/^(.+?)\s*\(@?([^)]+)\)/);
      if (titleMatch) {
        displayName = titleMatch[1].trim();
        username = titleMatch[2].trim();
      } else {
        // Fallback: og:title
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) {
          const ogText = decodeHtmlEntities(ogTitle.getAttribute('content') || '');
          const ogMatch = ogText.match(/^(.+?)\s*\(@?([^)]+)\)/);
          if (ogMatch) {
            displayName = ogMatch[1].trim();
            username = ogMatch[2].trim();
          }
        }
      }

      // --- Followers, Following & Bio from <meta name="description"> ---
      const descMeta =
        document.querySelector('meta[name="description"]') ||
        document.querySelector('meta[property="og:description"]');

      if (descMeta) {
        const descText = decodeHtmlEntities(descMeta.getAttribute('content') || '');

        // Followers: "168 Followers" or "1.2M Followers"
        const followersMatch = descText.match(/([\d,.\w]+)\s+Followers/i);
        if (followersMatch) followers = followersMatch[1];

        // Following: "2,762 Following"
        const followingMatch = descText.match(/([\d,.\w]+)\s+Following/i);
        if (followingMatch) following = followingMatch[1];

        // Bio: text after the last colon+quote block — "…on Instagram: "bio text here""
        const bioMatch = descText.match(/:\s*"(.+)"\s*$/s);
        if (bioMatch) bio = bioMatch[1].trim();
      }

      // --- Bio Link: external link inside <header> ---
      const headerLinks = document.querySelectorAll('header a[href]');
      for (const link of headerLinks) {
        const href = link.getAttribute('href') || '';
        // Instagram wraps external links through l.instagram.com or shows them directly
        if (
          href &&
          !href.startsWith('/') &&
          !href.includes('instagram.com') &&
          /^https?:\/\//.test(href)
        ) {
          bioLink = href;
          break;
        }
      }

      // Fallback: look for linktr.ee or similar in JSON state blobs
      if (!bioLink) {
        const scripts = document.querySelectorAll('script[type="application/json"]');
        for (const script of scripts) {
          const text = script.textContent || '';
          const urlMatch = text.match(/"(https?:\/\/(?!(?:www\.)?instagram\.com)[^\s"]+)"/);
          if (urlMatch) {
            bioLink = urlMatch[1];
            break;
          }
        }
      }

      return { username, displayName, bio, bioLink, followers, following };
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

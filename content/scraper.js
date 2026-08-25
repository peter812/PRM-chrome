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

(() => {
if (window.__prmScraperLoaded) return;
window.__prmScraperLoaded = true;

const sharedParser = new DOMParser();

/**
 * Decode HTML entities in a string (e.g. &#064; → @, &quot; → ").
 * @param {string} str
 * @returns {string}
 */
function decodeHtmlEntities(str) {
  if (!str) return '';
  const doc = sharedParser.parseFromString(str, 'text/html');
  return doc.documentElement.textContent || '';
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
        // Use URL parsing to reliably check the hostname
        let isInstagramLink = false;
        try {
          const linkUrl = new URL(href);
          isInstagramLink = linkUrl.hostname === 'instagram.com' ||
            linkUrl.hostname.endsWith('.instagram.com');
        } catch {
          // Not a valid URL — skip
          continue;
        }
        if (
          href &&
          !href.startsWith('/') &&
          !isInstagramLink &&
          /^https?:\/\//.test(href)
        ) {
          bioLink = href;
          break;
        }
      }

      // Fallback: look for linktr.ee or similar in JSON state blobs
      if (!bioLink) {
        const scripts = document.querySelectorAll('script[type="application/json"]');
        // Limit search to the first 10 script tags to avoid scanning excessively large blobs
        const maxScripts = Math.min(scripts.length, 10);
        for (let i = 0; i < maxScripts; i++) {
          const text = scripts[i].textContent || '';
          if (text.length > 500_000) continue; // skip very large blobs
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
 * Request data from the MAIN world injected script via window.postMessage.
 */
function fetchFromInjectContext(procedure, payload = {}) {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (event) => {
      if (event.data && event.data.error) {
        reject(new Error(event.data.error));
      } else {
        resolve(event.data);
      }
    };
    window.postMessage({ procedure, ...payload }, window.location.origin, [channel.port2]);
  });
}

/**
 * Map raw Instagram feed items to PRM-compatible schema.
 */
function mapInstagramFeed(feedData) {
  if (!feedData || !Array.isArray(feedData.items)) return [];

  return feedData.items.map(post => {
    const mediaUrls = [];

    if (post.media_type === 8 && Array.isArray(post.carousel_media)) {
      // Carousel post
      post.carousel_media.forEach(item => {
        const type = 'image'; // No video playback, thumbnails only
        if (item.image_versions2 && Array.isArray(item.image_versions2.candidates) && item.image_versions2.candidates.length > 0) {
          mediaUrls.push({ type, url: item.image_versions2.candidates[0].url });
        }
      });
    } else {
      // Single image or video (fallback to thumbnail cover image)
      const type = 'image';
      if (post.image_versions2 && Array.isArray(post.image_versions2.candidates) && post.image_versions2.candidates.length > 0) {
        mediaUrls.push({ type, url: post.image_versions2.candidates[0].url });
      }
    }

    return {
      post_id: post.id || post.pk,
      shortcode: post.code,
      caption: post.caption ? post.caption.text : "",
      taken_at: post.taken_at,
      media_type: post.media_type,
      mediaUrls
    };
  });
}

/**
 * Fetch a URL from the browser and convert to Base64 Data URL.
 */
async function downloadUrlAsBase64(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image from CDN: ${response.statusText}`);
  }
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read image as Base64"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Sequentially download and encode all media URLs for a post.
 */
async function downloadPostMedia(shortcode, mediaUrls) {
  const downloadedMedia = [];
  const mimeMap = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  };

  for (let i = 0; i < mediaUrls.length; i++) {
    const item = mediaUrls[i];
    try {
      const base64Data = await downloadUrlAsBase64(item.url);
      const mime = (base64Data.split(';')[0].split(':')[1] || '').toLowerCase();
      const cleanExt = mimeMap[mime] || 'jpg';
      downloadedMedia.push({
        type: item.type,
        filename: `${shortcode}_${i}.${cleanExt}`,
        data: base64Data
      });
    } catch (err) {
      console.warn(`[PRM] Failed to download image index ${i} for shortcode ${shortcode}:`, err.message);
      throw err;
    }
  }
  return downloadedMedia;
}

/**
 * Main entry point — called when the script is injected.
 * Listens for extraction requests from the service worker.
 */
function init() {
  if (window.__prmMessageListener) {
    try {
      chrome.runtime.onMessage.removeListener(window.__prmMessageListener);
    } catch (e) {
      // Ignore
    }
  }

  window.__prmMessageListener = (message, _sender, sendResponse) => {
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
      return false;
    } else if (message.type === 'PRM_GET_INSTAGRAM_FEED') {
      fetchFromInjectContext('loadUserFeed', { username: message.username })
        .then(result => {
          if (result.success && result.feed) {
            const posts = mapInstagramFeed(result.feed);
            sendResponse({ success: true, posts });
          } else {
            sendResponse({ success: false, error: result.error || "Failed to load feed data." });
          }
        })
        .catch(err => {
          sendResponse({ success: false, error: err.message });
        });
      return true; // Keep response channel open for async response
    } else if (message.type === 'PRM_DOWNLOAD_MEDIA') {
      downloadPostMedia(message.shortcode, message.mediaUrls)
        .then(media => {
          sendResponse({ success: true, media });
        })
        .catch(err => {
          sendResponse({ success: false, error: err.message });
        });
      return true; // Keep response channel open for async response
    }
    return false;
  };

  chrome.runtime.onMessage.addListener(window.__prmMessageListener);

  console.log('[PRM] Content script loaded — ready for extraction requests.');
}

init();

})();

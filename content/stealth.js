/**
 * Stealth / anti-detection helpers for the content script.
 *
 * Implements patches inspired by puppeteer-extra-plugin-stealth to make
 * the extension-injected page context look like a normal browser session.
 *
 * These patches run in the MAIN world (page context) to override
 * properties that bot-detection scripts typically check.
 */

/* eslint-disable no-empty */

/**
 * Apply all stealth patches. Call once per page load.
 */
function applyStealthPatches() {
  patchNavigatorWebdriver();
  patchNavigatorPlugins();
  patchNavigatorLanguages();
  patchChromeRuntime();
  patchPermissions();
  patchCodecs();
  addTimingJitter();
}

// ── Individual patches ───────────────────────────────────

/**
 * Remove the `navigator.webdriver` flag that headless / automated browsers set.
 */
function patchNavigatorWebdriver() {
  try {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => false,
      configurable: true,
    });
  } catch {}
}

/**
 * Spoof a non-empty `navigator.plugins` array (headless Chrome has length 0).
 */
function patchNavigatorPlugins() {
  try {
    const fakePlugins = {
      length: 3,
      item: (index) => fakePlugins[index] || null,
      namedItem: (name) => {
        for (let i = 0; i < fakePlugins.length; i++) {
          if (fakePlugins[i] && fakePlugins[i].name === name) return fakePlugins[i];
        }
        return null;
      },
      refresh: () => {},
      0: { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format', length: 1 },
      1: { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '', length: 1 },
      2: { name: 'Native Client', filename: 'internal-nacl-plugin', description: '', length: 2 },
    };

    Object.defineProperty(navigator, 'plugins', {
      get: () => fakePlugins,
      configurable: true,
    });
  } catch {}
}

/**
 * Ensure `navigator.languages` returns a plausible value.
 */
function patchNavigatorLanguages() {
  try {
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en'],
      configurable: true,
    });
  } catch {}
}

/**
 * Ensure `window.chrome.runtime` exists (it is absent in headless mode).
 */
function patchChromeRuntime() {
  try {
    if (!window.chrome) window.chrome = {};
    if (!window.chrome.runtime) {
      window.chrome.runtime = {
        connect: () => {},
        sendMessage: () => {},
      };
    }
  } catch {}
}

/**
 * Override Permissions.query to hide the "notifications denied" signal that
 * bot detectors use.
 */
function patchPermissions() {
  try {
    const originalQuery = window.Permissions.prototype.query;
    window.Permissions.prototype.query = function (params) {
      if (params && params.name === 'notifications') {
        return Promise.resolve({ state: 'prompt', onchange: null });
      }
      return originalQuery.call(this, params);
    };
  } catch {}
}

/**
 * Ensure common media codec support is reported (some detection scripts
 * check for codec availability).
 */
function patchCodecs() {
  try {
    const el = document.createElement('video');
    if (el.canPlayType) {
      const original = el.canPlayType.bind(el);
      HTMLVideoElement.prototype.canPlayType = function (type) {
        if (type === 'video/mp4; codecs="avc1.42E01E"') return 'probably';
        if (type === 'video/webm; codecs="vp8, vorbis"') return 'probably';
        return original(type);
      };
    }
  } catch {}
}

/**
 * Introduce a small random timing jitter to DOM reads so automated
 * high-frequency polling can be distinguished less easily.
 */
function addTimingJitter() {
  try {
    const origGetBCR = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = function () {
      const rect = origGetBCR.call(this);
      // Jitter by ±0.001px — imperceptible but breaks fingerprinting
      const jitter = () => (Math.random() - 0.5) * 0.002;
      return new DOMRect(
        rect.x + jitter(),
        rect.y + jitter(),
        rect.width + jitter(),
        rect.height + jitter(),
      );
    };
  } catch {}
}

// Auto-apply when injected
applyStealthPatches();

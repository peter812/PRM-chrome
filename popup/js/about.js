/**
 * About page logic.
 *
 * Populates version info and supported platforms list.
 */

import { supportedPlatforms } from '../../utils/url-matcher.js';

/**
 * Initialise the about page.
 */
function initAbout() {
  // Populate platforms list
  const platformsList = document.getElementById('about-platforms');
  if (platformsList) {
    const platforms = supportedPlatforms();
    platformsList.innerHTML = platforms.map((p) => `<li>${p}</li>`).join('');
  }

  // Set version from manifest (if available)
  const versionEl = document.getElementById('about-version');
  if (versionEl && chrome.runtime && chrome.runtime.getManifest) {
    try {
      const manifest = chrome.runtime.getManifest();
      versionEl.textContent = `v${manifest.version}`;
    } catch {
      // Fallback already set in HTML
    }
  }
}

export { initAbout };

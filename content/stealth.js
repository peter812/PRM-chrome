/**
 * Stealth / anti-detection helpers for the content script.
 *
 * Implements safe, native-looking patches to prevent headless bot detection
 * without breaking DOM deterministic layout or injecting detectable synthetic properties.
 *
 * Runs in the MAIN world (page context).
 */

/* eslint-disable no-empty */

(() => {
  if (window.__prmStealthReady) return;
  window.__prmStealthReady = true;

  function makeNativeString(fn, name) {
    Object.defineProperty(fn, 'name', { value: name, configurable: true });
    const fnToString = () => `function ${name}() { [native code] }`;
    Object.defineProperty(fn, 'toString', { value: fnToString, configurable: true });
    return fn;
  }

  /**
   * Ensure `navigator.webdriver` is false / undefined without revealing overrides.
   */
  function patchNavigatorWebdriver() {
    try {
      const proto = Object.getPrototypeOf(navigator);
      if (proto && 'webdriver' in proto) {
        delete proto.webdriver;
      }
      Object.defineProperty(navigator, 'webdriver', {
        get: makeNativeString(() => undefined, 'get webdriver'),
        configurable: true,
      });
    } catch {}
  }

  /**
   * Ensure `navigator.languages` returns standard values.
   */
  function patchNavigatorLanguages() {
    try {
      const defaultLangs = navigator.languages && navigator.languages.length > 0
        ? navigator.languages
        : ['en-US', 'en'];
      Object.defineProperty(navigator, 'languages', {
        get: makeNativeString(() => defaultLangs, 'get languages'),
        configurable: true,
      });
    } catch {}
  }

  /**
   * Override Permissions.query to return prompt state for notifications.
   */
  function patchPermissions() {
    try {
      if (!window.Permissions?.prototype?.query) return;
      const originalQuery = window.Permissions.prototype.query;
      const patchedQuery = function query(params) {
        if (params && params.name === 'notifications') {
          return Promise.resolve({ state: 'prompt', onchange: null });
        }
        return originalQuery.call(this, params);
      };
      window.Permissions.prototype.query = makeNativeString(patchedQuery, 'query');
    } catch {}
  }

  /**
   * Apply all stealth patches.
   */
  function applyStealthPatches() {
    patchNavigatorWebdriver();
    patchNavigatorLanguages();
    patchPermissions();
  }

  applyStealthPatches();
})();

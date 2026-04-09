/**
 * URL allow-list matching utilities.
 *
 * Checks whether a given URL belongs to one of the supported platforms.
 */

const SUPPORTED_DOMAINS = [
  { name: 'Instagram', pattern: /^https?:\/\/(www\.)?instagram\.com\//i },
  { name: 'Facebook', pattern: /^https?:\/\/(www\.)?facebook\.com\//i },
  { name: 'LinkedIn', pattern: /^https?:\/\/(www\.)?linkedin\.com\//i },
  { name: 'VSCO', pattern: /^https?:\/\/(www\.)?vsco\.co\//i },
];

/**
 * Check if a URL matches any supported domain.
 * @param {string} url
 * @returns {{ matched: boolean, platform: string|null }}
 */
function matchUrl(url) {
  for (const domain of SUPPORTED_DOMAINS) {
    if (domain.pattern.test(url)) {
      return { matched: true, platform: domain.name };
    }
  }
  return { matched: false, platform: null };
}

/**
 * Return the list of supported platform names.
 * @returns {string[]}
 */
function supportedPlatforms() {
  return SUPPORTED_DOMAINS.map((d) => d.name);
}

export { matchUrl, supportedPlatforms, SUPPORTED_DOMAINS };

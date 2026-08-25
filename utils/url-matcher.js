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
 * URL path segments that are not usernames on Instagram / Facebook.
 * @type {string[]}
 */
const NON_PROFILE_PATHS = [
  'p', 'reel', 'reels', 'stories', 'explore', 'direct', 'accounts',
  'about', 'legal', 'privacy', 'terms', 'emails', 'tv', 'developer', 'graphql',
  'groups', 'pages', 'events', 'watch', 'marketplace',
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
 * Extract the username from a supported social media profile URL.
 *
 * Handles URLs like:
 *   - https://instagram.com/{username}
 *   - https://www.instagram.com/{username}/
 *   - https://facebook.com/{username}
 *   - https://linkedin.com/in/{username}
 *   - https://vsco.co/{username}/gallery
 *
 * @param {string} url
 * @returns {{ username: string|null, platform: string|null }}
 */
function extractUsername(url) {
  const { matched, platform } = matchUrl(url);
  if (!matched || !platform) return { username: null, platform: null };

  try {
    const parsed = new URL(url);
    const segments = parsed.pathname
      .split('/')
      .filter((s) => s.length > 0);

    if (segments.length === 0) return { username: null, platform };

    let username = null;

    switch (platform) {
      case 'LinkedIn':
        // LinkedIn profile URLs: /in/{username}
        if (segments[0] === 'in' && segments[1]) {
          username = segments[1];
        }
        break;
      case 'VSCO':
        // VSCO URLs: /{username} or /{username}/gallery
        username = segments[0];
        break;
      case 'Instagram':
      case 'Facebook':
      default:
        // Instagram/Facebook: /{username}
        // Skip common non-profile paths
        if (NON_PROFILE_PATHS.includes(segments[0])) {
          return { username: null, platform };
        }
        username = segments[0];
        break;
    }

    return { username: username || null, platform };
  } catch {
    return { username: null, platform };
  }
}

/**
 * Return the list of supported platform names.
 * @returns {string[]}
 */
function supportedPlatforms() {
  return SUPPORTED_DOMAINS.map((d) => d.name);
}

function extractInstagramUsername(url) {
  const match = (url || '').match(/^https?:\/\/(www\.)?instagram\.com\/([a-zA-Z0-9_.]+)\/?(?:[?#].*)?$/);
  if (match && !['p', 'explore', 'reels', 'stories', 'direct', 'accounts', 'about', 'tv', 'reel'].includes(match[2])) {
    return match[2];
  }
  return null;
}

export { matchUrl, extractUsername, supportedPlatforms, SUPPORTED_DOMAINS, extractInstagramUsername };

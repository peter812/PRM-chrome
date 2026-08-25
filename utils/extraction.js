/**
 * Shared extraction pieces used by the background job runner.
 *
 * The DOM extractor here is handed to `chrome.scripting.executeScript({ func })`,
 * which serialises the function and re-parses it inside the Instagram tab. It
 * must therefore stay entirely self-contained — no imports, no closure over
 * anything in this module.
 */

/**
 * Read profile fields out of an Instagram profile page.
 * Runs in the page, not here. Returns empty strings rather than nulls so the
 * caller can treat every field the same way.
 */
export function inPageAccountExtractor() {
  const parser = new DOMParser();
  function decodeHtml(html) {
    if (!html) return '';
    const doc = parser.parseFromString(html, 'text/html');
    return doc.documentElement.textContent || '';
  }

  let username = null;
  let displayName = null;
  let bio = null;
  let bioLink = null;
  let followers = null;
  let following = null;
  let imageUrl = null;

  // 1. Username from URL pathname
  try {
    const segs = window.location.pathname.split('/').filter(Boolean);
    const nonUserPaths = ['p', 'reel', 'reels', 'stories', 'explore', 'direct', 'accounts', 'about', 'legal', 'privacy', 'terms', 'emails', 'tv', 'developer'];
    if (segs.length > 0 && !nonUserPaths.includes(segs[0])) {
      username = segs[0];
    }
  } catch (_) {}

  // 2. Title and og:title tags
  const titleText = decodeHtml(document.title || '');
  const titleMatch = titleText.match(/^(.+?)\s*\(@?([^)]+)\)/);
  if (titleMatch) {
    displayName = titleMatch[1].trim();
    if (!username) username = titleMatch[2].trim();
  }

  // og:image is the profile picture on an Instagram profile page, and is present
  // before the app finishes hydrating — unlike the avatar in the header DOM.
  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage) imageUrl = ogImage.getAttribute('content') || null;

  const ogTitle = document.querySelector('meta[property="og:title"]');
  if (ogTitle) {
    const ogText = decodeHtml(ogTitle.getAttribute('content') || '');
    const ogMatch = ogText.match(/^(.+?)\s*\(@?([^)]+)\)/);
    if (ogMatch) {
      if (!displayName) displayName = ogMatch[1].trim();
      if (!username) username = ogMatch[2].trim();
    }
  }

  // 3. Meta description for followers, following, and bio
  const descMeta = document.querySelector('meta[name="description"]') ||
                   document.querySelector('meta[property="og:description"]');
  if (descMeta) {
    const descText = decodeHtml(descMeta.getAttribute('content') || '');

    const followersMatch = descText.match(/([\d,.\w]+)\s+Followers/i);
    if (followersMatch) followers = followersMatch[1];

    const followingMatch = descText.match(/([\d,.\w]+)\s+Following/i);
    if (followingMatch) following = followingMatch[1];

    const bioMatch = descText.match(/:\s*"(.+)"\s*$/s);
    if (bioMatch) bio = bioMatch[1].trim();
  }

  // 4. Header DOM inspection
  const header = document.querySelector('header');
  if (header) {
    if (!displayName) {
      const heading = header.querySelector('h1, h2, h3');
      if (heading && heading.textContent) {
        displayName = heading.textContent.trim();
      }
    }

    // External website link
    const links = header.querySelectorAll('a[href]');
    for (const link of links) {
      const href = link.getAttribute('href') || '';
      try {
        const u = new URL(href, window.location.href);
        if (u.hostname !== 'instagram.com' && !u.hostname.endsWith('.instagram.com') && /^https?:\/\//.test(href)) {
          bioLink = href;
          break;
        }
      } catch (_) {}
    }

    // Fallback for bio from header text blocks
    if (!bio) {
      const spans = header.querySelectorAll('section > div > span, header span');
      for (const span of spans) {
        const text = span.textContent?.trim() || '';
        if (text.length > 5 && !text.includes('followers') && !text.includes('following') && !text.includes('posts')) {
          bio = text;
          break;
        }
      }
    }
  }

  return {
    username: username || '',
    displayName: displayName || username || '',
    bio: bio || '',
    bioLink: bioLink || '',
    followers: followers || '',
    following: following || '',
    imageUrl: imageUrl || '',
  };
}

/**
 * Parse a follower/following total as Instagram renders it in page metadata
 * — "168", "2,762", "15.3K", "1.2M" — into a plain integer.
 *
 * @returns {number|null} null when there is nothing parseable to send
 */
export function parseAbbreviatedCount(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : null;

  const raw = String(value).trim().replace(/,/g, '');
  const match = raw.match(/(\d+(?:\.\d+)?)\s*([kmb])?/i);
  if (!match) return null;

  const magnitude = { k: 1e3, m: 1e6, b: 1e9 }[(match[2] || '').toLowerCase()] || 1;
  const n = parseFloat(match[1]) * magnitude;
  return Number.isFinite(n) ? Math.round(n) : null;
}

/**
 * Convert scraped account objects into the raw CSV the server parses on ingest.
 */
export function arrayToCsv(users) {
  const headers = ['id', 'username', 'full_name', 'is_private', 'is_verified', 'profile_pic_url'];
  if (!Array.isArray(users) || users.length === 0) {
    return headers.join(',');
  }
  const rows = users.map((u) => [
    `"${String(u.id || '').replace(/"/g, '""')}"`,
    `"${String(u.username || '').replace(/"/g, '""')}"`,
    `"${String(u.fullName || u.full_name || '').replace(/"/g, '""')}"`,
    u.isPrivate ?? u.is_private ?? false,
    u.isVerified ?? u.is_verified ?? false,
    `"${String(u.profilePicUrl || u.profile_pic_url || '').replace(/"/g, '""')}"`,
  ].join(','));
  return [headers.join(','), ...rows].join('\r\n');
}

/** Fields every pending-import payload carries, whatever produced it. */
function basePayload(username) {
  return {
    uuid: crypto.randomUUID(),
    timestamp_added: new Date().toISOString(),
    timestamp_imported: null,
    already_added: false,
    account_username: username,
    account_display_name: '',
    account_bio: '',
    account_website: '',
    account_email: '',
    account_phone: '',
    account_location_area: '',
    // Only a graph walk produces CSVs; a profile-only scrape reports totals.
    account_followers: null,
    account_following: null,
    account_image_url: null,
    account_followers_count: null,
    account_following_count: null,
  };
}

/** Payload for a profile-only scrape, from `inPageAccountExtractor` output. */
export function buildAccountPayload(scraped, fallbackUsername) {
  return {
    ...basePayload(scraped.username || fallbackUsername),
    import_type: 'account',
    account_display_name: scraped.displayName || scraped.username || fallbackUsername,
    account_bio: scraped.bio || '',
    account_website: scraped.bioLink || '',
    account_image_url: scraped.imageUrl || null,
    account_followers_count: parseAbbreviatedCount(scraped.followers),
    account_following_count: parseAbbreviatedCount(scraped.following),
  };
}

/** Payload for a follower/following walk, from the injected graph extractor. */
export function buildGraphPayload({ profile, followers, following }, fallbackUsername) {
  return {
    ...basePayload(profile.username || fallbackUsername),
    import_type: 'full',
    account_display_name: profile.fullName || '',
    account_bio: profile.biography || '',
    account_website: profile.externalUrl || '',
    account_email: profile.publicEmail || '',
    account_phone: profile.contactPhoneNumber || '',
    account_location_area: profile.category || '',
    account_followers: arrayToCsv(followers),
    account_following: arrayToCsv(following),
    account_image_url: profile.profilePicUrl || null,
    // Totals as Instagram reports them, which can exceed the rows actually
    // walked once the per-side cap kicks in.
    account_followers_count: parseAbbreviatedCount(profile.followerCount),
    account_following_count: parseAbbreviatedCount(profile.followingCount),
  };
}

/**
 * Reusable Instagram GraphQL & REST Scraper for PRM-Chrome
 *
 * Capabilities:
 * - Query hash-based pagination for followers & following
 * - Search user by username
 * - Rate limiting, jitter delay, 429 backoff
 * - Export preparation & schema mapping
 */

export class InstagramScraper {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000;
    this.baseDelay = options.baseDelay || 6000; // ms delay between requests
    this.maxRetries = options.maxRetries || 3;

    this.headers = {
      'accept': '*/*',
      'x-asbd-id': '198387',
      'x-ig-app-id': '936619743392459',
    };

    this.queryHashes = {
      followers: '37479f2b8209594dde7facb0d904896a',
      following: '58712303d941c6855d4e888c5f0cd22f',
    };
  }

  /**
   * Calculate random jitter to avoid static interval fingerprinting.
   */
  getJitterDelay(ms) {
    return ms + Math.ceil(ms * 0.25 * Math.random());
  }

  /**
   * Helper sleep promise.
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, this.getJitterDelay(ms)));
  }

  /**
   * Resolve an Instagram username to numeric ID and basic profile info.
   */
  async getUserByUsername(username) {
    const cleanUsername = String(username).trim().replace(/^@/, '');
    const url = `https://www.instagram.com/web/search/topsearch/?context=blended&query=${encodeURIComponent(cleanUsername)}&include_reel=false`;

    const res = await fetch(url, {
      method: 'GET',
      headers: this.headers,
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error(`Failed searching user @${cleanUsername} (${res.status} ${res.statusText})`);
    }

    const data = await res.json();
    const match = data.users?.find(
      (u) => u.user.username.toLowerCase() === cleanUsername.toLowerCase(),
    );

    if (!match) {
      throw new Error(`Instagram user @${cleanUsername} not found.`);
    }

    return {
      id: match.user.pk,
      username: match.user.username,
      fullName: match.user.full_name,
      isPrivate: match.user.is_private,
      isVerified: match.user.is_verified,
      profilePicUrl: match.user.profile_pic_url,
    };
  }

  /**
   * Fetches detailed profile information for a user ID.
   */
  async getUserInfo(userId) {
    const url = `https://i.instagram.com/api/v1/users/${userId}/info/`;
    const res = await fetch(url, {
      method: 'GET',
      headers: this.headers,
      credentials: 'include',
    });

    if (!res.ok) {
      throw new Error(`Failed fetching user info for ${userId} (${res.status})`);
    }

    const data = await res.json();
    const user = data.user;

    return {
      id: user.pk,
      username: user.username,
      fullName: user.full_name,
      isPrivate: user.is_private,
      isVerified: user.is_verified,
      followerCount: user.follower_count,
      followingCount: user.following_count,
      biography: user.biography,
      externalUrl: user.external_url,
      publicEmail: user.public_email || '',
      contactPhoneNumber: user.contact_phone_number || '',
      category: user.category || '',
      profilePicUrl: user.profile_pic_url,
    };
  }

  /**
   * Scrapes followers or following with pagination and progress callbacks.
   * @param {Object} params
   * @param {string} params.userId - Instagram numeric user ID
   * @param {'followers'|'following'} params.type - Scrape type
   * @param {number} [params.maxLimit=Infinity] - Total records to fetch
   * @param {number} [params.pageSize=50] - Number of items per request
   * @param {string} [params.startCursor=''] - End cursor to resume from
   * @param {Function} [params.onProgress] - (batch, totalCollected, endCursor, hasNextPage) => void
   * @param {Function} [params.isCancelled] - () => boolean
   */
  async scrapeUsers({
    userId,
    type = 'followers',
    maxLimit = Infinity,
    pageSize = 50,
    startCursor = '',
    onProgress = null,
    isCancelled = () => false,
  }) {
    const queryHash = this.queryHashes[type.toLowerCase()];
    if (!queryHash) {
      throw new Error(`Invalid scrape type "${type}". Must be "followers" or "following".`);
    }

    let endCursor = startCursor;
    let hasNextPage = true;
    let totalCollected = 0;
    const allResults = [];

    while (hasNextPage && totalCollected < maxLimit) {
      if (isCancelled()) {
        break;
      }

      const count = Math.min(pageSize, maxLimit - totalCollected);
      const variables = {
        id: String(userId),
        include_reel: false,
        fetch_mutual: false,
        first: count,
      };

      if (endCursor) {
        variables.after = endCursor;
      }

      const url = `https://www.instagram.com/graphql/query/?query_hash=${queryHash}&variables=${encodeURIComponent(JSON.stringify(variables))}`;

      let responseData = null;
      let attempt = 0;

      while (attempt < this.maxRetries) {
        try {
          const res = await fetch(url, {
            method: 'GET',
            headers: this.headers,
            credentials: 'include',
          });

          if (res.status === 429) {
            const backoffTime = (attempt + 1) * 5000;
            console.warn(`[InstagramScraper] Rate limited (429). Waiting ${backoffTime}ms...`);
            await this.sleep(backoffTime);
            attempt++;
            continue;
          }

          if (!res.ok) {
            throw new Error(`HTTP error ${res.status}: ${res.statusText}`);
          }

          responseData = await res.json();
          break;
        } catch (err) {
          attempt++;
          if (attempt >= this.maxRetries) throw err;
          await this.sleep(2000 * attempt);
        }
      }

      if (!responseData || !responseData.data || !responseData.data.user) {
        throw new Error('Unexpected Instagram response format or session verification required.');
      }

      const edge =
        type.toLowerCase() === 'followers'
          ? responseData.data.user.edge_followed_by
          : responseData.data.user.edge_follow;

      if (!edge || !edge.edges) {
        break;
      }

      const batch = edge.edges.map((e) => ({
        id: e.node.id,
        username: e.node.username,
        fullName: e.node.full_name,
        isPrivate: e.node.is_private,
        isVerified: e.node.is_verified,
        profilePicUrl: e.node.profile_pic_url,
      }));

      allResults.push(...batch);
      totalCollected += batch.length;
      endCursor = edge.page_info?.end_cursor || '';
      hasNextPage = edge.page_info?.has_next_page && !!endCursor;

      if (onProgress) {
        onProgress(batch, totalCollected, endCursor, hasNextPage);
      }

      if (hasNextPage && totalCollected < maxLimit) {
        await this.sleep(this.baseDelay);
      }
    }

    return {
      results: allResults,
      total: totalCollected,
      endCursor,
      hasNextPage,
    };
  }

  /**
   * Run a complete account import scrape:
   * 1. Resolves numeric user ID & profile metadata via getUserInfo(userId).
   * 2. Scrapes followers graph.
   * 3. Scrapes following graph.
   * 4. Constructs pending_social_account_imports payload with CSV strings & UUID.
   *
   * @param {string} username
   * @param {Object} [options]
   * @param {Function} [options.onProgress] - (phase, message) => void
   * @param {Function} [options.isCancelled] - () => boolean
   * @returns {Promise<Object>} Pending import payload
   */
  async runFullAccountImport(username, options = {}) {
    const { onProgress, isCancelled = () => false } = options;

    if (onProgress) onProgress('resolving', `Resolving @${username}...`);

    const basicUser = await this.getUserByUsername(username);
    if (!basicUser || !basicUser.id) {
      throw new Error(`Could not resolve Instagram User ID for @${username}`);
    }

    if (onProgress) onProgress('metadata', `Fetching profile details for @${username}...`);
    let userInfo = {};
    try {
      userInfo = await this.getUserInfo(basicUser.id);
    } catch (err) {
      console.warn(`[InstagramScraper] getUserInfo failed, fallback to basic info:`, err.message);
      userInfo = basicUser;
    }

    if (isCancelled()) throw new Error('Scrape cancelled by user.');

    if (onProgress) onProgress('followers', `Scraping followers graph for @${username}...`);
    const followersRes = await this.scrapeUsers({
      userId: basicUser.id,
      type: 'followers',
      onProgress: (_batch, total) => {
        if (onProgress) onProgress('followers_progress', `Scraped ${total} followers...`);
      },
      isCancelled,
    });

    if (isCancelled()) throw new Error('Scrape cancelled by user.');

    if (onProgress) onProgress('following', `Scraping following graph for @${username}...`);
    const followingRes = await this.scrapeUsers({
      userId: basicUser.id,
      type: 'following',
      onProgress: (_batch, total) => {
        if (onProgress) onProgress('following_progress', `Scraped ${total} following...`);
      },
      isCancelled,
    });

    const followersCsv = arrayToCsv(followersRes.results || []);
    const followingCsv = arrayToCsv(followingRes.results || []);

    const uuid = typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `import_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return {
      uuid,
      timestamp_added: new Date().toISOString(),
      timestamp_imported: null,
      already_added: false,
      account_username: userInfo.username || username,
      account_display_name: userInfo.fullName || basicUser.fullName || '',
      account_bio: userInfo.biography || '',
      account_website: userInfo.externalUrl || '',
      account_email: userInfo.publicEmail || '',
      account_phone: userInfo.contactPhoneNumber || '',
      account_location_area: userInfo.category || '',
      account_followers: followersCsv,
      account_following: followingCsv,
    };
  }
}

/**
 * Convert array of contact objects into raw CSV format.
 * @param {Array<Object>} users
 * @returns {string}
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


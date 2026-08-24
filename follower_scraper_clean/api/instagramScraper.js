/**
 * Standalone Clean Instagram Scraper Client
 * Completely decoupled from external licensing/telemetry servers.
 * Features:
 * - Direct GraphQL & REST communication using browser session cookies
 * - Auto-pagination with customizable batch size and cursor
 * - Jittered rate-limiting and exponential retry backoff
 * - Profile search and metadata enrichment
 * - Unlimited export quota
 */

export class InstagramScraper {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000;
    this.baseDelay = options.baseDelay || 2000; // ms delay between pages
    this.maxRetries = options.maxRetries || 3;
    
    this.headers = {
      'accept': '*/*',
      'x-asbd-id': '198387',
      'x-ig-app-id': '936619743392459'
    };

    this.queryHashes = {
      followers: '37479f2b8209594dde7facb0d904896a',
      following: '58712303d941c6855d4e888c5f0cd22f'
    };
  }

  /**
   * Calculates random jitter to prevent static bot detection patterns
   */
  getJitterDelay(ms) {
    return ms + Math.ceil(ms * 0.2 * Math.random());
  }

  /**
   * Helper sleep promise
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, this.getJitterDelay(ms)));
  }

  /**
   * Resolves an Instagram username to user ID and metadata
   */
  async getUserByUsername(username) {
    const cleanUsername = String(username).trim().replace(/^@/, '');
    const url = `https://www.instagram.com/web/search/topsearch/?context=blended&query=${encodeURIComponent(cleanUsername)}&include_reel=false`;

    const res = await fetch(url, {
      method: 'GET',
      headers: this.headers,
      credentials: 'include'
    });

    if (!res.ok) {
      throw new Error(`Failed searching user (${res.status} ${res.statusText})`);
    }

    const data = await res.json();
    const match = data.users?.find(u => u.user.username.toLowerCase() === cleanUsername.toLowerCase());
    
    if (!match) {
      throw new Error(`Instagram user @${cleanUsername} not found.`);
    }

    return {
      id: match.user.pk,
      username: match.user.username,
      fullName: match.user.full_name,
      isPrivate: match.user.is_private,
      isVerified: match.user.is_verified,
      profilePicUrl: match.user.profile_pic_url
    };
  }

  /**
   * Fetches detailed profile information for a user ID
   */
  async getUserInfo(userId) {
    const url = `https://i.instagram.com/api/v1/users/${userId}/info/`;
    const res = await fetch(url, {
      method: 'GET',
      headers: this.headers,
      credentials: 'include'
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
      profilePicUrl: user.profile_pic_url
    };
  }

  /**
   * Scrapes followers or following with unlimited pagination and real-time progress callbacks
   * @param {Object} params
   * @param {string} params.userId - Target Instagram numeric user ID
   * @param {'followers'|'following'} params.type - Scraping type
   * @param {number} [params.maxLimit=Infinity] - Total records to scrape (unlimited by default)
   * @param {number} [params.pageSize=50] - Number of items per request
   * @param {string} [params.startCursor=''] - Resume cursor if continuing a previous run
   * @param {Function} [params.onProgress] - Callback (resultsBatch, totalCollected, endCursor, hasNextPage)
   * @param {Function} [params.isCancelled] - Function returning true if scraping was stopped by user
   */
  async scrapeUsers({
    userId,
    type = 'followers',
    maxLimit = Infinity,
    pageSize = 50,
    startCursor = '',
    onProgress = null,
    isCancelled = () => false
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
        first: count
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
            credentials: 'include'
          });

          if (res.status === 429) {
            // Rate limited - back off
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
        throw new Error('Unexpected Instagram response format or missing user data.');
      }

      const edge = type.toLowerCase() === 'followers'
        ? responseData.data.user.edge_followed_by
        : responseData.data.user.edge_follow;

      if (!edge || !edge.edges) {
        break;
      }

      const batch = edge.edges.map(e => ({
        id: e.node.id,
        username: e.node.username,
        fullName: e.node.full_name,
        isPrivate: e.node.is_private,
        isVerified: e.node.is_verified,
        profilePicUrl: e.node.profile_pic_url // direct Instagram CDN URL without third-party proxy
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
      hasNextPage
    };
  }
}

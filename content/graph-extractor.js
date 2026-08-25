/**
 * Follower/following walker, injected into the Instagram tab by the background
 * job runner.
 *
 * It runs here rather than in the service worker for two reasons: requests are
 * same-origin so the session cookie rides along without any host juggling, and
 * a page is not torn down for idling. An MV3 service worker is, which would
 * kill a walk that spends most of its minutes waiting between pages. Every
 * progress message it posts also wakes the worker back up.
 */

/* global chrome */

// executeScript re-runs this file on every injection; only wire up once.
if (!self.__prmGraphExtractorReady) {
  self.__prmGraphExtractorReady = true;

  const HEADERS = {
    accept: '*/*',
    'x-asbd-id': '198387',
    'x-ig-app-id': '936619743392459',
  };

  const QUERY_HASHES = {
    followers: '37479f2b8209594dde7facb0d904896a',
    following: '58712303d941c6855d4e888c5f0cd22f',
  };

  const PAGE_SIZE = 50;
  const PAGE_DELAY_MS = 6000;
  const MAX_RETRIES = 3;

  /** Sleep with jitter, so the request cadence isn't a metronome. */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms + Math.ceil(ms * 0.25 * Math.random())));

  /**
   * Send to the worker without waiting for a reply. The worker answers none of
   * these, so an un-caught send rejects as soon as the port closes.
   */
  const notify = (payload) => chrome.runtime.sendMessage(payload).catch(() => {});

  const report = (jobId, phase, message) => notify({ type: 'PRM_EXTRACT_PROGRESS', jobId, phase, message });

  /** Resolve a username to the numeric ID the graph endpoints need. */
  async function resolveUserId(username) {
    const clean = String(username).trim().replace(/^@/, '');
    const url = `https://www.instagram.com/web/search/topsearch/?context=blended&query=${encodeURIComponent(clean)}&include_reel=false`;

    const res = await fetch(url, { headers: HEADERS, credentials: 'include' });
    if (!res.ok) throw new Error(`Could not search for @${clean} (HTTP ${res.status})`);

    const data = await res.json();
    const match = data.users?.find((u) => {
      const uname = u?.user?.username || u?.username || '';
      return uname.toLowerCase() === clean.toLowerCase();
    });
    const pk = match?.user?.pk || match?.user?.id || match?.pk || match?.id;
    if (!pk) throw new Error(`Instagram user @${clean} not found.`);
    return pk;
  }

  /** Profile metadata — bio, links, public contact details, totals. */
  async function fetchProfile(userId, username) {
    const clean = String(username || '').trim().replace(/^@/, '');
    const endpoints = [
      `https://www.instagram.com/api/v1/users/${userId}/info/`,
      `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(clean)}`,
    ];

    for (const url of endpoints) {
      try {
        const res = await fetch(url, { headers: HEADERS, credentials: 'include' });
        if (!res.ok) continue;
        const data = await res.json();
        const user = data.user || data.data?.user;
        if (user) {
          return {
            username: user.username || clean,
            fullName: user.full_name || '',
            profilePicUrl: user.hd_profile_pic_url_info?.url || user.profile_pic_url_hd || user.profile_pic_url || '',
            biography: user.biography || '',
            externalUrl: user.external_url || '',
            publicEmail: user.public_email || '',
            contactPhoneNumber: user.contact_phone_number || '',
            category: user.category_name || user.category || '',
            followerCount: user.follower_count || user.edge_followed_by?.count || 0,
            followingCount: user.following_count || user.edge_follow?.count || 0,
          };
        }
      } catch (_) {}
    }

    // Fallback if metadata endpoint is restricted, allowing the follower walk to proceed
    return {
      username: clean,
      fullName: '',
      profilePicUrl: '',
      biography: '',
      externalUrl: '',
      publicEmail: '',
      contactPhoneNumber: '',
      category: '',
      followerCount: 0,
      followingCount: 0,
    };
  }

  /** Page through one side of the graph, stopping at `maxRecords`. */
  async function walk(jobId, userId, type, maxRecords, signal) {
    const queryHash = QUERY_HASHES[type];
    const collected = [];
    let cursor = '';
    let hasNextPage = true;

    while (hasNextPage && collected.length < maxRecords) {
      if (signal?.aborted) throw new Error('Extraction cancelled.');

      const variables = {
        id: String(userId),
        include_reel: false,
        fetch_mutual: false,
        first: Math.min(PAGE_SIZE, maxRecords - collected.length),
      };
      if (cursor) variables.after = cursor;

      const url = `https://www.instagram.com/graphql/query/?query_hash=${queryHash}&variables=${encodeURIComponent(JSON.stringify(variables))}`;

      let payload = null;
      let lastStatus = 200;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        if (signal?.aborted) throw new Error('Extraction cancelled.');

        const res = await fetch(url, { headers: HEADERS, credentials: 'include', signal });
        lastStatus = res.status;

        if (res.status === 429) {
          report(jobId, type, `Rate limited (429). Backing off ${(attempt + 1) * 6}s...`);
          await sleep((attempt + 1) * 6000);
          continue;
        }
        if (!res.ok) throw new Error(`Instagram returned HTTP ${res.status} while reading ${type}.`);

        payload = await res.json();
        break;
      }

      if (!payload) {
        if (lastStatus === 429) {
          throw new Error(`Rate limit exceeded for ${type} after ${MAX_RETRIES} retries. Please try again later.`);
        }
        throw new Error(`Failed to retrieve data for ${type} (HTTP ${lastStatus}).`);
      }

      if (payload.errors || payload.status === 'fail') {
        const errorMsg = payload.message || payload.errors?.[0]?.message || 'GraphQL query returned an error.';
        throw new Error(`Instagram API Error: ${errorMsg}`);
      }

      const edge = type === 'followers'
        ? payload?.data?.user?.edge_followed_by
        : payload?.data?.user?.edge_follow;
      if (!edge?.edges) {
        throw new Error(`Unexpected ${type} response — Instagram may require re-authentication.`);
      }

      collected.push(...edge.edges
        .filter((e) => e?.node)
        .map((e) => ({
          id: e.node.id || '',
          username: e.node.username || '',
          fullName: e.node.full_name || '',
          isPrivate: Boolean(e.node.is_private),
          isVerified: Boolean(e.node.is_verified),
          profilePicUrl: e.node.profile_pic_url || '',
        })));

      cursor = edge.page_info?.end_cursor || '';
      hasNextPage = Boolean(edge.page_info?.has_next_page && cursor);

      report(jobId, type, `Collected ${collected.length} ${type}...`);

      if (hasNextPage && collected.length < maxRecords) await sleep(PAGE_DELAY_MS);
    }

    return collected;
  }

  async function run({ jobId, username, maxRecords, signal }) {
    report(jobId, 'resolving', `Resolving @${username}...`);
    const userId = await resolveUserId(username);

    report(jobId, 'profile', `Reading profile for @${username}...`);
    const profile = await fetchProfile(userId, username);

    const followers = await walk(jobId, userId, 'followers', maxRecords, signal);
    const following = await walk(jobId, userId, 'following', maxRecords, signal);

    return { profile, followers, following };
  }

  let activeAbortController = null;

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'PRM_CANCEL_GRAPH') {
      if (activeAbortController) {
        activeAbortController.abort();
        activeAbortController = null;
      }
      return;
    }

    if (message?.type !== 'PRM_RUN_GRAPH') return;

    if (activeAbortController) {
      activeAbortController.abort();
    }
    activeAbortController = new AbortController();
    const { signal } = activeAbortController;

    run({ ...message, signal })
      .then((data) => {
        if (!signal.aborted) {
          notify({ type: 'PRM_EXTRACT_RESULT', jobId: message.jobId, data });
        }
      })
      .catch((err) => {
        if (!signal.aborted) {
          notify({
            type: 'PRM_EXTRACT_ERROR',
            jobId: message.jobId,
            error: err?.message || String(err),
          });
        }
      });
  });
}

/**
 * Shared rendering utilities for social account cards.
 *
 * Used by both the URL Info page and the Results page to display
 * social account data in a consistent card format.
 */

/**
 * Minimal HTML escaping to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

/**
 * Normalize a social account object from the API into a standard shape.
 * Handles varying field names across different API response formats.
 * @param {object} account – raw account object from the API
 * @returns {object} – normalized account fields
 */
function normalizeAccount(account) {
  return {
    name: account.name || account.full_name || account.username || 'Unknown',
    username: account.username || account.handle || '',
    platform: account.platform || '',
    bio: account.bio || account.description || '',
    followers: account.followers || account.follower_count || '',
    following: account.following || account.following_count || '',
    posts: account.posts || account.post_count || '',
    profileUrl: account.profile_url || account.url || '',
    avatar: account.avatar_url || account.profile_pic_url || '',
  };
}

/**
 * Render a social account card.
 * @param {object} account – raw account object from the API
 * @param {object} [options] – rendering options
 * @param {boolean} [options.showFollowing=false] – show following count
 * @param {boolean} [options.showPosts=false] – show post count
 * @returns {string} – HTML string
 */
function renderSocialAccountCard(account, options = {}) {
  const { showFollowing = false, showPosts = false } = options;
  const a = normalizeAccount(account);

  const avatarAlt = `Profile picture of ${escapeHtml(a.name)}`;

  return `
    <div class="social-account-card">
      <div class="social-account-header">
        ${a.avatar ? `<img class="social-account-avatar" src="${escapeHtml(a.avatar)}" alt="${avatarAlt}" />` : `<div class="social-account-avatar-placeholder">${escapeHtml(a.name.charAt(0).toUpperCase())}</div>`}
        <div class="social-account-info">
          <span class="social-account-name">${escapeHtml(a.name)}</span>
          ${a.username ? `<span class="social-account-username">@${escapeHtml(a.username)}</span>` : ''}
        </div>
        ${a.platform ? `<span class="badge badge-info">${escapeHtml(a.platform)}</span>` : ''}
      </div>
      ${a.bio ? `<p class="social-account-bio">${escapeHtml(a.bio)}</p>` : ''}
      <div class="social-account-meta">
        ${a.followers ? `<span class="social-account-stat">👥 ${escapeHtml(String(a.followers))} followers</span>` : ''}
        ${showFollowing && a.following ? `<span class="social-account-stat">➡ ${escapeHtml(String(a.following))}</span>` : ''}
        ${showPosts && a.posts ? `<span class="social-account-stat">📄 ${escapeHtml(String(a.posts))}</span>` : ''}
        ${a.profileUrl ? `<a class="social-account-link" href="${escapeHtml(a.profileUrl)}" target="_blank" rel="noopener noreferrer">View Profile ↗</a>` : ''}
      </div>
    </div>
  `;
}

export { escapeHtml, normalizeAccount, renderSocialAccountCard };

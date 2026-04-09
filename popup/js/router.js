/**
 * Lightweight client-side router for the popup SPA.
 *
 * Pages are <section class="page"> elements inside #page-container.
 * Navigation buttons have a `data-page` attribute matching the page id suffix.
 */

const navButtons = () => document.querySelectorAll('#navbar .nav-btn');
const pages = () => document.querySelectorAll('#page-container .page');

/**
 * Navigate to a page by name (e.g. "home", "settings", "url-info", "scraping").
 * @param {string} pageName
 * @param {Function} [onShow] – optional callback fired after the page becomes visible
 */
function navigateTo(pageName, onShow) {
  // Deactivate all pages and nav buttons
  pages().forEach((p) => p.classList.remove('active'));
  navButtons().forEach((b) => b.classList.remove('active'));

  // Activate the target page
  const target = document.getElementById(`page-${pageName}`);
  if (target) {
    target.classList.add('active');
  }

  // Activate the matching nav button
  const btn = document.querySelector(`.nav-btn[data-page="${pageName}"]`);
  if (btn) {
    btn.classList.add('active');
  }

  if (typeof onShow === 'function') {
    onShow();
  }
}

/**
 * Bind click handlers on all nav buttons.
 * @param {Record<string, Function>} pageCallbacks – map of pageName → onShow callback
 */
function initRouter(pageCallbacks = {}) {
  navButtons().forEach((btn) => {
    btn.addEventListener('click', () => {
      const pageName = btn.dataset.page;
      navigateTo(pageName, pageCallbacks[pageName]);
    });
  });
}

export { navigateTo, initRouter };

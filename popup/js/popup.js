/**
 * Popup bootstrap — wires up router, page callbacks, and initial render.
 */

import { initRouter, navigateTo } from './router.js';
import { initHome } from './home.js';
import { initSettings } from './settings.js';
import { initUrlInfo } from './url-info.js';
import { initResults } from './results.js';
import { initAbout } from './about.js';

document.addEventListener('DOMContentLoaded', () => {
  // Define callbacks that fire when each page is shown
  const pageCallbacks = {
    home: initHome,
    settings: initSettings,
    'url-info': initUrlInfo,
    results: initResults,
    about: initAbout,
  };

  // Wire up nav-bar click handling
  initRouter(pageCallbacks);

  // Show the home page on open
  initHome();
});

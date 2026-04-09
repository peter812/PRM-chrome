# PRM Chrome Extension — Preparation Plan

## 1. Overview

Build a Chrome Extension (Manifest V3) that:

- Reads the current tab URL and checks it against a configurable allow-list.
- Scrapes web pages while employing advanced anti-detection / scraper-avoidance techniques.
- Looks for specific, to-be-defined data points on matched pages.
- Communicates with a user-configured remote API.
- Provides a multi-page popup UI accessible from the browser toolbar.

---

## 2. Extension Architecture

```
PRM-chrome/
├── manifest.json            # Manifest V3 configuration
├── background/
│   └── service-worker.js    # Background service worker
├── content/
│   ├── scraper.js           # Content script – scraping logic
│   └── stealth.js           # Anti-detection / fingerprint evasion helpers
├── popup/
│   ├── index.html           # Popup entry point (SPA shell)
│   ├── pages/
│   │   ├── main.html        # Main / dashboard page
│   │   ├── settings.html    # Settings page (API URL, allow-list, etc.)
│   │   ├── results.html     # Scrape results / history page
│   │   └── about.html       # About / help page
│   ├── css/
│   │   └── styles.css       # Shared styles
│   └── js/
│       ├── router.js        # Simple client-side page router
│       ├── main.js          # Main page logic
│       ├── settings.js      # Settings page logic
│       ├── results.js       # Results page logic
│       └── popup.js         # Popup bootstrap / initialisation
├── utils/
│   ├── url-matcher.js       # URL allow-list matching utilities
│   ├── api-client.js        # Fetch wrapper for the remote API
│   └── storage.js           # chrome.storage helpers
├── icons/
│   ├── icon-16.png
│   ├── icon-48.png
│   └── icon-128.png
└── README.md
```

---

## 3. Manifest V3 Configuration

Key permissions and fields to declare:

| Field | Value / Notes |
|---|---|
| `manifest_version` | `3` |
| `permissions` | `activeTab`, `storage`, `scripting`, `tabs` |
| `host_permissions` | `<all_urls>` (needed for content-script injection on matched URLs) |
| `background.service_worker` | `background/service-worker.js` |
| `action.default_popup` | `popup/index.html` |
| `content_scripts` | Injected programmatically via `chrome.scripting.executeScript` on matched URLs |

---

## 4. URL Allow-List Matching

### How It Works

1. A list of URL patterns (strings or regex) is stored in `chrome.storage.sync`.
2. When a tab is updated or the user clicks the extension icon, the service worker retrieves the current URL.
3. `url-matcher.js` compares the URL against the stored list.
4. If the URL matches, the extension activates scraping (injects the content script) and/or updates the popup badge.

### Configuring the List

- Users can add / remove URL patterns via the **Settings** page.
- The list may also be fetched from the remote API at a configurable interval.

---

## 5. Advanced Scraper Avoidance

The content script (`content/stealth.js`) will implement or integrate anti-detection measures:

| Technique | Description |
|---|---|
| **Navigator property spoofing** | Override `navigator.webdriver`, `navigator.plugins`, `navigator.languages` to look like a normal browser. |
| **WebGL / Canvas fingerprint randomisation** | Slightly alter canvas/WebGL output to prevent fingerprint tracking. |
| **Timing jitter** | Add random delays between DOM reads and network requests to mimic human browsing. |
| **MutationObserver awareness** | Detect and adapt to pages that monitor DOM mutations as a bot signal. |
| **Header normalisation** | Ensure requests made from the extension carry standard browser headers (handled via `declarativeNetRequest` rules). |
| **Iframe sandboxing** | Optionally load target pages in a sandboxed iframe to isolate detection scripts. |
| **User-agent rotation** | Rotate or normalise the User-Agent string per-request or per-session. |
| **Puppeteer-extra-plugin-stealth parity** | Implement the same patches that `puppeteer-extra-plugin-stealth` applies (e.g., `chrome.runtime`, `Permissions`, `codecs`). |

> **Note:** The specific data points to scrape will be defined later. The scraping engine will be designed with a pluggable extraction interface so new selectors / rules can be added without changing core logic.

---

## 6. Popup UI — Multi-Page Design

The popup is a single HTML shell (`popup/index.html`) with a lightweight client-side router that swaps page content without reloading.

### Pages

| Page | Purpose |
|---|---|
| **Main** | Shows current tab status (matched / not matched), quick actions, and a summary of recent scrapes. |
| **Settings** | • API URL input field (validated & saved to `chrome.storage.sync`). • URL allow-list editor (add, remove, import/export). • Scraping preferences (delays, stealth level). |
| **Results** | Table or card view of scraped data with timestamps, filterable by URL. |
| **About** | Version info, links to documentation, license. |

### Navigation

- A persistent top or side navigation bar with icons/labels for each page.
- Active page is highlighted.
- Transition animations (optional) for a polished feel.

---

## 7. API Communication

### Configuration

- The user enters the API base URL on the **Settings** page.
- The URL is validated (must be HTTPS, reachable) before saving.

### Endpoints (to be finalised with the API team)

| Action | Method | Endpoint (example) | Payload |
|---|---|---|---|
| Send scraped data | `POST` | `/api/v1/scrape-results` | `{ url, data, timestamp }` |
| Fetch URL allow-list | `GET` | `/api/v1/url-list` | — |
| Heartbeat / auth check | `GET` | `/api/v1/ping` | — |

### Implementation Notes

- All requests go through `utils/api-client.js`, which handles:
  - Base URL resolution
  - Auth headers (token stored in `chrome.storage.sync`)
  - Retry with exponential back-off
  - Error surfacing to the popup UI

---

## 8. Data Storage

| Store | Use |
|---|---|
| `chrome.storage.sync` | Settings (API URL, auth token, URL list, preferences) — synced across devices. |
| `chrome.storage.local` | Scraped results cache, logs — device-local, larger quota. |

---

## 9. Development & Build

| Item | Detail |
|---|---|
| **Language** | Vanilla JavaScript (ES Modules) — keep dependencies minimal for review-ability. |
| **Bundler** | Optional — Vite or Rollup if module bundling is needed; otherwise, plain files loaded directly. |
| **Linting** | ESLint with `eslint-plugin-chrome-extension`. |
| **Testing** | Jest + `jest-chrome` for unit tests; Puppeteer for E2E popup tests. |
| **CI** | GitHub Actions: lint → test → package `.zip` artifact on every push. |

---

## 10. Implementation Phases

### Phase 1 — Skeleton & Popup Shell
- [ ] Set up `manifest.json` and directory structure.
- [ ] Implement the popup SPA shell with router and navigation.
- [ ] Build the **Settings** page with API URL input and storage.

### Phase 2 — URL Matching & Badge
- [ ] Implement `url-matcher.js` and integrate with the service worker.
- [ ] Show match status in the popup **Main** page and via the extension badge icon.

### Phase 3 — Content Script & Stealth Layer
- [ ] Create `scraper.js` with a pluggable extraction interface (selectors TBD).
- [ ] Implement `stealth.js` anti-detection measures.
- [ ] Wire programmatic injection from the service worker on URL match.

### Phase 4 — API Integration
- [ ] Build `api-client.js` with retry, auth, and error handling.
- [ ] Connect scraped data pipeline: content script → service worker → API.
- [ ] Implement allow-list sync from API.

### Phase 5 — Polish & Release
- [ ] Results page UI.
- [ ] About page.
- [ ] CI pipeline (lint, test, package).
- [ ] Chrome Web Store listing assets and documentation.

---

## 11. Open Questions / TBD

1. **What specific data points should the scraper extract?** — Awaiting definition.
2. **Authentication mechanism for the API** — API key, OAuth, or other?
3. **Should the URL allow-list support wildcards, regex, or both?**
4. **Rate-limiting / throttling requirements for scraping?**
5. **Should scraped data be queued offline and sent when connectivity resumes?**

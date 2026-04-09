# PRM Chrome Extension

A Manifest V3 Chrome Extension for PRM — matches URLs against a configurable allow-list, scrapes target pages with anti-detection techniques, and forwards extracted data to a user-configured remote API.

## Features

- **URL allow-list matching** — activate the extension only on pages you care about
- **Page data extraction** — pluggable scraping engine with a stealth layer
- **Remote API integration** — POST results to your own endpoint; syncs the allow-list from the API
- **Multi-page popup UI** — Main, Settings, Results, and About pages with client-side routing
- **Cross-device settings sync** — preferences stored in `chrome.storage.sync`

## Quick Install

> **Requirements:** Google Chrome 109+ (or any Chromium-based browser that supports Manifest V3)

1. [Download or clone](https://github.com/peter812/PRM-chrome) this repository to your machine.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the root folder of this repository (`PRM-chrome/`).
5. The extension icon will appear in your Chrome toolbar.

For a full walkthrough — including updating the extension, configuring the API URL, and troubleshooting — see **[install.md](install.md)**.

## Project Structure

```
PRM-chrome/
├── manifest.json            # Manifest V3 configuration
├── background/
│   └── service-worker.js    # Background service worker
├── content/
│   ├── scraper.js           # Content script – scraping logic
│   └── stealth.js           # Anti-detection helpers
├── popup/
│   ├── index.html           # Popup entry point (SPA shell)
│   ├── pages/               # Individual page templates
│   ├── css/styles.css       # Shared styles
│   └── js/                  # Page controllers & router
├── utils/
│   ├── url-matcher.js       # URL allow-list matching
│   ├── api-client.js        # Fetch wrapper for the remote API
│   └── storage.js           # chrome.storage helpers
└── icons/                   # Extension icons (16, 48, 128 px)
```

## Configuration

After installing, click the extension icon and open **Settings** to:

- Enter your **API base URL** (must be HTTPS)
- Manage your **URL allow-list** (add, remove, or import/export patterns)
- Adjust scraping preferences (delays, stealth level)

## Development

The extension uses vanilla JavaScript (ES Modules) with no bundler — all files are loaded directly by Chrome.

```bash
# Clone the repo
git clone https://github.com/peter812/PRM-chrome.git

# Load the folder as an unpacked extension (see Quick Install above)
# Edit source files and click the ↺ reload button on chrome://extensions to apply changes
```

Planned tooling: ESLint, Jest + jest-chrome, Puppeteer E2E tests, and a GitHub Actions CI pipeline. See [prepare.md](prepare.md) for the full development plan.

## License

MIT

# Installing PRM Chrome Extension — Detailed Guide

## Requirements

| Requirement | Details |
|---|---|
| Browser | Google Chrome 109 or newer (or any Chromium-based browser with Manifest V3 support, e.g. Edge, Brave, Opera) |
| Operating system | Windows, macOS, or Linux |
| Permissions | Ability to enable Developer mode in Chrome |

---

## 1. Download the Extension Files

**Option A — Clone with Git**

```bash
git clone https://github.com/peter812/PRM-chrome.git
```

**Option B — Download ZIP**

1. Go to [https://github.com/peter812/PRM-chrome](https://github.com/peter812/PRM-chrome).
2. Click the green **Code** button → **Download ZIP**.
3. Extract the ZIP to a permanent location on your machine (e.g. `~/extensions/PRM-chrome`).

> ⚠️ Do **not** move or delete the folder after loading it — Chrome references the folder directly.

---

## 2. Enable Developer Mode in Chrome

1. Open Chrome and go to `chrome://extensions` in the address bar.
2. In the top-right corner of the page, toggle **Developer mode** on.

![Developer mode toggle location](https://developer.chrome.com/static/docs/extensions/get-started/tutorial/hello-world/image/extensions-page-e0d64d89a6acf_856.png)

---

## 3. Load the Unpacked Extension

1. Click the **Load unpacked** button that appears after enabling Developer mode.
2. In the file picker, navigate to and select the root `PRM-chrome/` folder — the folder that contains `manifest.json`.
3. Click **Select Folder** (Windows/Linux) or **Open** (macOS).

The extension will appear in your list with the name **PRM Chrome Extension** and a version number.

---

## 4. Pin the Extension to the Toolbar (Optional)

1. Click the puzzle-piece **Extensions** icon (🧩) in the Chrome toolbar.
2. Find **PRM Chrome Extension** in the list.
3. Click the pin icon to keep it visible in the toolbar.

---

## 5. First-Time Configuration

1. Click the **PRM Chrome Extension** icon in the toolbar to open the popup.
2. Navigate to the **Settings** page.
3. Enter your **API base URL** (must be an `https://` address).
4. Add one or more **URL patterns** to the allow-list — the extension will only activate on pages whose URLs match these patterns.
5. Click **Save**. Settings are synced via `chrome.storage.sync` and will be available across devices signed into the same Chrome profile.

---

## 6. Updating the Extension

Because the extension is loaded from a local folder, updates are applied by pulling the latest code and reloading:

```bash
# Inside the cloned folder
git pull
```

Then:

1. Go to `chrome://extensions`.
2. Find **PRM Chrome Extension** and click the **↺ reload** icon.

The extension will reload with the updated files — no need to re-add it.

---

## 7. Verifying the Installation

- Visit a URL that matches one of your allow-list patterns.
- The extension icon should reflect the active state (badge or icon change).
- Open the popup → **Main** page to confirm the current tab is detected as a match.
- Check the **Results** page after the extension scrapes a page.

---

## 8. Removing the Extension

1. Go to `chrome://extensions`.
2. Find **PRM Chrome Extension** and click **Remove**.
3. Confirm the removal.

Your settings stored in `chrome.storage.sync` will also be cleared.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| "Manifest file is missing or unreadable" | Make sure you selected the folder that contains `manifest.json`, not a parent folder or the icons subfolder. |
| Extension loads but icon doesn't appear | Click the 🧩 Extensions icon and pin PRM Chrome Extension (see Step 4). |
| Settings are not saved | Check that Chrome has permission to use `chrome.storage`. Try reloading the extension. |
| Extension stops working after a Chrome update | Chrome may have disabled the extension if there is an error. Check `chrome://extensions` for error messages and click **Errors** for details, then reload or re-add the extension. |
| Content script not injecting | Ensure `host_permissions` in `manifest.json` includes `<all_urls>` and that the tab URL matches your allow-list. |

---

## Notes for Developers

- The extension uses **Manifest V3** with vanilla JavaScript (ES Modules) — no build step required.
- Source files can be edited in place. After saving, click ↺ reload on `chrome://extensions` to apply changes.
- Use `chrome://extensions` → **Inspect views: service worker** to open DevTools for the background service worker.
- Use right-click → **Inspect** on the popup HTML to debug the popup UI.
- See [prepare.md](prepare.md) for the full architecture plan and development phases.

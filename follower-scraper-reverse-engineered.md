# Instagram Follower Scraper — Reverse-Engineered Technical Documentation

This document contains a complete breakdown of the reverse-engineered extension code from [`follower scraper example/`](file:///c:/Repos/PRM-chrome/follower%20scraper%20example), extracted into [`follower_scraper_decompiled/`](file:///c:/Repos/PRM-chrome/follower_scraper_decompiled).

---

## 1. Extension Architecture Overview

The extension is structured around a Manifest V3 architecture:
- **Service Worker (`sw.js`)**: Loads vendor chunks and background scripts.
- **Background Controller (`background/35710.js`)**:
  - Manages persistent ports using `chrome.runtime.onConnect` and custom correlation IDs (`cid`).
  - Handles authentication and licensing with `https://service.igexporttools.com/jeecg-boot/miniapp`.
  - Manages extension sync storage (`chrome.storage.sync`).
- **Scraper Engine & UI (`popup/46288.js`)**:
  - Orchestrates the Instagram follower/following scraping process.
  - Queries Instagram's GraphQL and REST APIs with proper headers and authentication context.
  - Applies pagination, retry loops, rate-limit backoff, and jitter delays.
  - Formats and exports data to CSV / JSON.

---

## 2. Instagram API & Query Hashes

### Headers Required
```json
{
  "accept": "*/*",
  "x-asbd-id": "198387",
  "x-ig-app-id": "936619743392459"
}
```

### Endpoints & Queries

| Type | Endpoint / Query Hash | Description |
| :--- | :--- | :--- |
| **Followers Query Hash** | `37479f2b8209594dde7facb0d904896a` | Queries `https://www.instagram.com/graphql/query/?query_hash=37479f2b8209594dde7facb0d904896a&variables={id, first, after}` |
| **Following Query Hash** | `58712303d941c6855d4e888c5f0cd22f` | Queries `https://www.instagram.com/graphql/query/?query_hash=58712303d941c6855d4e888c5f0cd22f&variables={id, first, after}` |
| **Profile Doc ID** | `27937681195819736` | GraphQL query for user profile details |
| **Search Doc ID** | `26347858941511777` | GraphQL query for account search |
| **User REST API** | `https://www.instagram.com/api/v1/users/{id}/info/` | Fetches full public profile metadata |
| **Friendship Status** | `https://www.instagram.com/api/v1/friendships/show/{id}/` | Checks mutual relationship state |
| **Topsearch** | `https://www.instagram.com/web/search/topsearch/` | Resolves username to Instagram numeric User ID |

---

## 3. Scraping & Rate-Limiting Logic

### Pagination Parameters
- **Batch Size (`first`)**: Defaults to 50 items per page.
- **Cursor (`after`)**: Extracted from `page_info.end_cursor` in the GraphQL response (`edge_followed_by` or `edge_follow`).

### Delay & Jitter Algorithm
- Jitter is added to the base delay:
  ```js
  function addJitter(baseDelay) {
    return baseDelay + Math.ceil(baseDelay * 0.2 * Math.random());
  }
  ```

### Error & Rate-Limit Handling (`L` Constants)
- **`FATAL`**: Account blocked, banned, or session invalid.
- **`NEEDS_VERIFY`**: Instagram triggered a checkpoint / challenge verification (`https://www.instagram.com/challenge/...`). Prompts user to open Instagram tab and solve checkpoint.
- **`RATE_LIMITED`** (HTTP 429): Enters exponential backoff / cooldown period.
- **`RETRYABLE`**: Transient network or 5xx error; retries with delay up to max attempts.

---

## 4. Extracted Profile Data Fields

For each scraped user profile, the extension extracts:
- `id` (Instagram User ID)
- `username`
- `full_name`
- `is_private`
- `is_verified`
- `profile_pic_url`
- `follower_count`
- `following_count`
- `biography`
- `external_url`
- `public_email` (if business profile)
- `contact_phone_number` (if business profile)
- `category_name` (business category)

---

## 5. Deobfuscated Files Location

All decompiled modules and reports are organized in:
- [`follower_scraper_decompiled/background/`](file:///c:/Repos/PRM-chrome/follower_scraper_decompiled/background) — Background worker modules
- [`follower_scraper_decompiled/popup/`](file:///c:/Repos/PRM-chrome/follower_scraper_decompiled/popup) — Popup UI and scraping core (`46288.js`)
- [`follower_scraper_decompiled/ANALYSIS_SUMMARY.md`](file:///c:/Repos/PRM-chrome/follower_scraper_decompiled/ANALYSIS_SUMMARY.md) — Raw endpoint scan summary
- [`tools/deobfuscate.mjs`](file:///c:/Repos/PRM-chrome/tools/deobfuscate.mjs) — The reusable deobfuscation script

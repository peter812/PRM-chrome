# TruePeopleSearch Injection & Scraping — Build Plan

Inject PRM status UI into `www.truepeoplesearch.com` pages and add scraping that
pushes data back to the PRM backend. Spans **PRM-chrome** (extension) and
**PRM** (`server/` backend).

Reference pages: `PRM-chrome/html-examples/true-people-search-person-page.html`
(person: Danna Fallang) and `true-people-search-results-page.html` (phone search
`(509) 216-5687`).

---

## 1. Confirmed behavior (from Q&A)

| Topic | Decision |
|---|---|
| **Found match rule** | **Name only** (case-insensitive, normalized first+last) against PRM `people`. |
| **Results page** | Per-result chip: red **"Not Found"** / green **"Found"**. |
| **Person page — Found** | Rounded "PRM" box: Found chip + **Extract** chip (`not extracted`→`extracting`→`extracted`). Extract scrapes full record into new `true_person_search` table. |
| **Person page — Not Found** | Rounded "PRM" box: Not-Found chip + **"Add to PRM"** button (creates a `people` contact). |
| **Extract trigger** | Manual click. |
| **Persistence** | TPS person id linked on the PRM side (see §2); revisits recompute status. |
| **Page scope** | `/results?...` and `/find/person/{id}` only. (Not `/find/{ln}/{fn}` browse.) |
| **Gating** | **Standalone** — active whenever the extension is paired. Independent of PRM-osint settings. |

**TPS id** = the `/find/person/{id}` slug (e.g. `p6494ur922n98r4n6urn`), found in each
result card's `data-detail-link` and in the person page URL.

---

## 2. Data model (PRM backend)

### New table `true_person_search` (`shared/schema.ts` + migration)

Holds the rich scraped record. One row per extracted TPS person.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid pk | |
| `tps_id` | text unique | the `/find/person/{id}` slug — idempotency key |
| `person_id` | varchar → `people.id` | the Found PRM contact this was extracted for (nullable) |
| `import_date` | timestamp | when extracted |
| `full_name` | text | |
| `akas` | jsonb (string[]) | "also seen as" |
| `birthday` | text | |
| `current_address` | text | |
| `current_address_property_details` | text | |
| `current_address_property_url` | text | property link on page |
| `addresses` | jsonb | array of `{ address, propertyUrl }` (all additional addresses) |
| `phone_numbers` | jsonb (string[]) | additional numbers |
| `emails` | jsonb (string[]) | |
| `relatives` | jsonb | array of `{ name, age, tpsId }` |
| `associates` | jsonb | array of `{ name, age, tpsId }` |
| `background_profile` | text (large) | |
| `created_at` | timestamp | |

### `people` table linkage (§Q: "field on person")

Add `tps_id text` (nullable) to `people`. Set when a contact is created via
**Add to PRM** or linked on Extract. Lets a revisit resolve Found→this contact and
avoid duplicate adds.

**Extract status is derived, not stored:** a `true_person_search` row for a `tps_id`
⇒ `extracted`; otherwise `not extracted`. `extracting` is transient client state.

---

## 3. Backend endpoints (PRM `server/routes/`)

New module `server/routes/tps.ts`, registered in `server/routes.ts`. All routes
authenticate with the **`X-Extension-Token`** pattern via `authenticateExtensionToken()`
(mirroring `/api/v1/posts/import` in `social-media.ts`) and are added to
`PUBLIC_API_PATHS` in `auth-setup.ts` so they bypass the session gate.

1. **`POST /api/v1/tps/match`** — batch Found check (results page).
   - Body: `{ items: [{ tpsId, name }] }`
   - For each, name-only search (`storage.getAllPeople(name)` → normalized first+last compare).
   - Returns `{ results: { [tpsId]: { found: boolean, personUuid?: string } } }` (keyed by tpsId so the right card is painted even with duplicate names).

2. **`GET /api/v1/tps/person-status?tpsId=..&name=..`** — person page.
   - Returns `{ found, personUuid?, extracted, tpsRecordId? }`.
   - `found` = name search; `extracted` = `true_person_search` row exists for `tpsId`.

3. **`POST /api/v1/tps/add`** — "Add to PRM" (Not Found path).
   - Body: `{ tpsId, firstName, lastName, age?, city?, state?, phone? }`.
   - Creates a `people` row (identity fields only), sets `people.tps_id`.
   - Returns `{ personUuid }`.

4. **`POST /api/v1/tps/extract`** — Extract (Found path).
   - Body: full scraped payload matching `true_person_search` columns + `tpsId` + `personUuid`.
   - Upsert on `tps_id` (idempotent). Sets `person_id`, `people.tps_id` if not set.
   - Returns `{ tpsRecordId, status: "extracted" }`.

---

## 4. Extension (PRM-chrome)

### Injection mechanism
- Add a **static `content_scripts`** entry in `manifest.json` matching
  `*://*.truepeoplesearch.com/*`, running `content/truepeoplesearch.js` at
  `document_idle`. Kept **separate** from the Instagram service-worker pipeline
  (`scraper.js`/`sendToApi`) so TPS never touches the IG import flow.
- `host_permissions` already `<all_urls>`; the content script fetches PRM directly
  using `prmServerUrl` + `extensionSessionToken` from `chrome.storage.local`
  (same values `utils/api-client.js` uses), sending the `X-Extension-Token` header.

### New `content/truepeoplesearch.js` (plain IIFE, like `scraper.js`)
Detects page type from `location.pathname`:

**Results page (`/results`)**
1. Collect every result card — `.card-summary[data-detail-link]` and the primary
   expanded card — reading `tpsId` (from `data-detail-link` / `.detail-link` href)
   and name (`.h4` / card heading). *(Exact selectors finalized against the sample file.)*
2. One `POST /api/v1/tps/match`.
3. Paint a rounded chip into each card: green **Found** / red **Not Found**.

**Person page (`/find/person/{id}`)**
1. Read `#personDetails` (`data-fn`, `data-ln`, `data-city`, `data-state`, `data-age`)
   and `tpsId` from the URL.
2. `GET /api/v1/tps/person-status`.
3. Inject a rounded **"PRM"** box **immediately after `#personDetails`**:
   - Title `PRM`.
   - Found chip: green **Found** / red **Not Found**.
   - If Found → **Extract** chip showing derived status. Click →
     scrape full page → `POST /api/v1/tps/extract`; chip `extracting`→`extracted`.
   - If Not Found → **"Add to PRM"** button. Click → `POST /api/v1/tps/add`;
     on success re-check status → box swaps to Found + Extract.

### Person-page scrape map (for Extract)
Extracted from the person page DOM into the `true_person_search` shape: full name,
AKAs, birthday/age, current address + property details + property URL, all
additional addresses (with property URLs), additional phone numbers, emails,
possible relatives (`name`, `age`, `tpsId` from their `/find/person/{id}` links),
possible associates (same shape), and the background profile text. *(DOM selector
mapping done against the reference person page during implementation.)*

### Styling
Follow `PRM-chrome/design_guidelines.md`. Rounded pill chips: green = found,
red = not found; neutral/blue for extract states. Match TruePeopleSearch's
Bootstrap card look so injected boxes feel native.

---

## 5. Matching logic (name-only)
- Normalize: lowercase, trim, collapse whitespace, compare **first + last**
  (ignore middle name/initial, e.g. results card "Danna M Fallang" vs contact
  "Danna Fallang"). Confirm this normalization is acceptable.
- `found = true` if ≥1 `people` row matches the normalized name.

---

## 6. Sequencing
1. **Schema + migration**: `true_person_search` table, `people.tps_id`.
2. **Backend**: `server/routes/tps.ts` (4 endpoints) + register + `PUBLIC_API_PATHS`
   + `storage` helpers (name match, insert/upsert TPS record, create contact).
3. **Extension**: manifest match + `content/truepeoplesearch.js` (results chips →
   person box → Add to PRM → Extract).
4. **Verify** against both reference HTML pages, then live.

---

## 7. Open items to confirm (defaults I'll use unless told otherwise)
1. **"Add to PRM" fields** — default: identity only (first/last, age, city/state,
   phone). Full data comes later via Extract once the contact is Found. OK, or
   should Add also run the full scrape immediately?
2. **`people.tps_id` linkage** — OK to add this column, or keep TPS ids only in
   `true_person_search`?
3. **Name normalization** — first+last ignoring middle (see §5). OK?
4. **Relatives/associates** — stored as names+ids inside `true_person_search`
   only; **not** auto-created as `people` contacts. OK?
5. **Re-extract** — clicking Extract again refreshes the existing row (upsert). OK?

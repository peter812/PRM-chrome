/**
 * Content script — TruePeopleSearch (TPS) PRM injections.
 *
 * Runs on www.truepeoplesearch.com (see manifest content_scripts). Two flows:
 *
 *   Results page  (/results?...):
 *     Collect every result card's name + TPS id, ask PRM which are known, and
 *     paint a green "Found" / red "Not Found" chip on each card.
 *
 *   Person page   (/find/person/{id}):
 *     Inject a rounded "PRM" box under the name header showing Found status.
 *       - Found     → Extract chip (not extracted → extracting → extracted).
 *                     Extract scrapes the full record into PRM (true_person_search).
 *       - Not Found → "Add to PRM" button that creates a contact.
 *
 * Talks to the PRM backend directly with the stored server URL + extension
 * session token (X-Extension-Token), the same credentials the popup uses.
 */

/* eslint-disable no-console */

(() => {
  "use strict";

  // Guard against double injection (e.g. bfcache restores).
  if (window.__prmTpsInjected) return;
  window.__prmTpsInjected = true;

  // Last computed results-page counts, surfaced to the popup's TrueDB tab.
  const pageState = { foundCount: null };

  // ── API ──────────────────────────────────────────────────────────────────────
  //
  // Requests are proxied through the background service worker rather than issued
  // from here. In Manifest V3 a content script's fetch runs with the *page's*
  // origin and is subject to CORS, so a direct cross-origin call to PRM (with the
  // custom X-Extension-Token header) is blocked by a preflight PRM never answers.
  // The service worker keeps the extension's host-permission privileges, so it can
  // reach PRM directly.

  function apiFetch(path, { method = "GET", body } = {}) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "PRM_TPS_API", path, method, body }, (res) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }
          resolve(res || { ok: false, error: "No response from background." });
        });
      } catch (err) {
        resolve({ ok: false, error: err.message || "Messaging failed." });
      }
    });
  }

  // ── Small DOM helpers ────────────────────────────────────────────────────────

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  /**
   * Read an element's text with <br> treated as a ", " separator. A plain-text
   * sentinel marks <br> so real commas (e.g. "$690,000") are never disturbed.
   */
  function readText(el) {
    if (!el) return "";
    const BR = "@@BR@@";
    let out = "";
    el.childNodes.forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE) out += n.textContent;
      else if (n.nodeName === "BR") out += BR;
      else out += readText(n);
    });
    return out
      .replace(/[ \t\r\n]+/g, " ")
      .replace(/\s*(@@BR@@\s*)+/g, ", ")
      .replace(/^[,\s]+|[,\s]+$/g, "")
      .trim();
  }

  const absoluteUrl = (href) => {
    try {
      return href ? new URL(href, location.origin).href : null;
    } catch {
      return null;
    }
  };

  /** Extract the /find/person/{id} slug from a href or path. */
  function tpsIdFromHref(href) {
    if (!href) return null;
    const m = href.match(/\/find\/person\/([A-Za-z0-9]+)/);
    return m ? m[1] : null;
  }

  const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));

  // ── UI elements ────────────────────────────────────────────────────────────
  // Styling lives in content/truepeoplesearch.css (loaded via the manifest).

  function chip(kind, text) {
    const el = document.createElement("span");
    el.className = `prm-chip prm-chip--${kind}`;
    const dot = document.createElement("span");
    dot.className = "prm-chip__dot";
    el.appendChild(dot);
    el.appendChild(document.createTextNode(text));
    return el;
  }

  // ── Results page ─────────────────────────────────────────────────────────────

  async function handleResultsPage() {
    const cards = $$(".card-summary[data-detail-link]").filter((c) => !c.classList.contains("d-none"));
    const items = [];
    const cardByTpsId = new Map();

    for (const card of cards) {
      if (card.querySelector(".prm-chip")) continue; // already tagged
      const tpsId = tpsIdFromHref(card.getAttribute("data-detail-link"));
      const nameEl = card.querySelector(".content-header, .h4");
      const name = nameEl ? nameEl.textContent.trim() : "";
      if (!tpsId || !name) continue;
      items.push({ tpsId, name });
      // A tps id can appear on multiple responsive card copies — track them all.
      if (!cardByTpsId.has(tpsId)) cardByTpsId.set(tpsId, []);
      cardByTpsId.get(tpsId).push({ card, nameEl });
    }

    if (items.length === 0) return;

    console.log(`[PRM] TruePeopleSearch: matching ${items.length} result(s) against PRM…`);
    const res = await apiFetch("/api/v1/tps/match", { method: "POST", body: { items } });
    if (!res.ok) {
      console.warn(
        `[PRM] TPS match failed: ${res.error || "unknown error"}` +
        (res.notConnected ? " (open the PRM extension and pair)" : ""),
      );
      return;
    }

    const results = (res.data && res.data.results) || {};
    let foundCount = 0;
    for (const [tpsId, entries] of cardByTpsId.entries()) {
      const found = !!(results[tpsId] && results[tpsId].found);
      if (found) foundCount++;
      for (const { nameEl } of entries) {
        if (!nameEl || nameEl.querySelector(".prm-chip")) continue;
        const c = found ? chip("found", "Found") : chip("notfound", "Not Found");
        c.style.marginLeft = ".5rem";
        nameEl.appendChild(c);
      }
    }
    pageState.foundCount = foundCount;
  }

  // ── Page info for the popup TrueDB tab ─────────────────────────────────────────

  /** Describe the current TPS page for the popup (computed fresh from the DOM). */
  function getPageInfo() {
    const path = location.pathname;
    if (/^\/results/i.test(path)) {
      const ids = new Set(
        $$(".card-summary[data-detail-link]")
          .filter((c) => !c.classList.contains("d-none"))
          .map((c) => tpsIdFromHref(c.getAttribute("data-detail-link")))
          .filter(Boolean),
      );
      return { pageType: "search", resultCount: ids.size, foundCount: pageState.foundCount };
    }
    if (/^\/find\/person\//i.test(path)) {
      const d = document.getElementById("personDetails");
      const name = d
        ? `${d.dataset.fn || ""} ${d.dataset.ln || ""}`.trim()
        : ((($("h1.oh1") || {}).textContent) || "").trim();
      return { pageType: "person", personName: name || null };
    }
    return { pageType: "other" };
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "PRM_TPS_PAGE_INFO") {
      sendResponse(getPageInfo());
    }
    return false; // synchronous response
  });

  // ── Person page: scraping ─────────────────────────────────────────────────────

  /** The content block that follows a #toc-{id} divider (the section body). */
  function sectionBlock(tocId) {
    const divider = document.getElementById(tocId);
    return divider ? divider.nextElementSibling : null;
  }

  function scrapeAkas() {
    const block = sectionBlock("toc-akas");
    if (!block) return [];
    const dataRow = block.querySelector(".row.pl-sm-2");
    if (!dataRow) return [];
    const spans = $$("span", dataRow).map((s) => s.textContent.trim()).filter(Boolean);
    if (spans.length) return uniq(spans);
    return uniq(dataRow.textContent.split(",").map((s) => s.trim()));
  }

  function scrapeBirthday() {
    const headerText = (($("#personDetails span") || {}).textContent) || "";
    // e.g. "Age 47, Born November 1978Lives in ..." → capture "November 1978" (or bare year).
    const m = headerText.match(/Born\s+((?:[A-Za-z]+\s+)?\d{4})/i);
    return m ? m[1].trim() : null;
  }

  function scrapeEmails() {
    const block = sectionBlock("toc-emails");
    if (!block) return [];
    const matches = (block.textContent || "").match(/[\w.+-]+@[\w-]+\.[\w.-]+/g) || [];
    return uniq(matches.map((e) => e.trim()));
  }

  function scrapeAddresses() {
    const anchors = $$('a[data-link-to-more="address"]');
    const seen = new Set();
    const addresses = [];
    for (const a of anchors) {
      const address = readText(a);
      if (!address || seen.has(address.toLowerCase())) continue;
      seen.add(address.toLowerCase());
      addresses.push({ address, propertyUrl: absoluteUrl(a.getAttribute("href")) });
    }
    return addresses;
  }

  function currentAddressAnchor() {
    const block = sectionBlock("toc-current-address");
    return (block && block.querySelector('a[data-link-to-more="address"]')) ||
      $('a[data-link-to-more="address"]');
  }

  function scrapePhones() {
    return uniq($$('a[data-link-to-more="phone"]').map((a) => readText(a)));
  }

  function scrapeRelations(type) {
    const seen = new Set();
    const out = [];
    for (const a of $$(`a[data-link-to-more="${type}"]`)) {
      const name = readText(a);
      const tpsId = tpsIdFromHref(a.getAttribute("href"));
      const key = `${name}|${tpsId}`;
      if (!name || seen.has(key)) continue;
      seen.add(key);
      const details = a.parentElement ? a.parentElement.querySelector(".dt-ln") : null;
      const ageMatch = details ? (details.textContent || "").match(/Age\s*(\d+)/i) : null;
      out.push({ name, age: ageMatch ? ageMatch[1] : null, tpsId });
    }
    return out;
  }

  function scrapeBackground() {
    // #toc-bio is the content card itself (not a divider); read its column text,
    // excluding the sibling FAQ block.
    const el = document.getElementById("toc-bio");
    if (!el) return null;
    const col = el.querySelector(".col") || el;
    const text = (col.textContent || "").replace(/\s+/g, " ").trim();
    return text || null;
  }

  function scrapePersonRecord(tpsId, personId) {
    const details = document.getElementById("personDetails");
    const fullName = details
      ? `${details.dataset.fn || ""} ${details.dataset.ln || ""}`.trim()
      : ((($("h1.oh1") || {}).textContent) || "").trim();

    const currentAnchor = currentAddressAnchor();
    const currentAddress = currentAnchor ? readText(currentAnchor) : null;
    const currentAddressPropertyUrl = currentAnchor ? absoluteUrl(currentAnchor.getAttribute("href")) : null;
    const currentDetailsEl = currentAnchor && currentAnchor.parentElement
      ? currentAnchor.parentElement.querySelector(".dt-ln")
      : null;

    return {
      tpsId,
      personId: personId || null,
      fullName: fullName || null,
      akas: scrapeAkas(),
      birthday: scrapeBirthday(),
      currentAddress,
      currentAddressPropertyDetails: currentDetailsEl ? readText(currentDetailsEl) : null,
      currentAddressPropertyUrl,
      addresses: scrapeAddresses(),
      phoneNumbers: scrapePhones(),
      emails: scrapeEmails(),
      relatives: scrapeRelations("relative"),
      associates: scrapeRelations("associate"),
      backgroundProfile: scrapeBackground(),
    };
  }

  // ── Person page: UI ────────────────────────────────────────────────────────────

  function extractChipEl(status) {
    const map = {
      not_extracted: () => chip("neutral", "Not extracted"),
      extracting: () => chip("busy", "Extracting…"),
      extracted: () => chip("found", "Extracted"),
    };
    return (map[status] || map.not_extracted)();
  }

  async function handlePersonPage() {
    const tpsId = tpsIdFromHref(location.pathname);
    const details = document.getElementById("personDetails");
    if (!tpsId || !details || document.getElementById("prm-tps-box")) return;

    const name = `${details.dataset.fn || ""} ${details.dataset.ln || ""}`.trim();

    // Build the box shell immediately so the user sees PRM is present.
    const box = document.createElement("div");
    box.className = "prm-box";
    box.id = "prm-tps-box";
    const head = document.createElement("div");
    head.className = "prm-box__head";
    const title = document.createElement("span");
    title.className = "prm-box__title";
    title.textContent = "PRM";
    head.appendChild(title);
    box.appendChild(head);
    const msg = document.createElement("div");
    msg.className = "prm-box__msg";
    box.appendChild(msg);

    // Place the box directly under the name / age / location / phone block —
    // inside the #personDetails card, above the sponsored "Full Background
    // Report" section — rather than after the whole (tall) card.
    const nameCol = details.querySelector(".row.pl-md-1 .col");
    const nameRow = details.querySelector(".row.pl-md-1");
    if (nameCol) {
      nameCol.appendChild(box);
    } else if (nameRow) {
      nameRow.insertAdjacentElement("afterend", box);
    } else {
      details.insertAdjacentElement("afterend", box);
    }

    const statusRes = await apiFetch(
      `/api/v1/tps/person-status?tpsId=${encodeURIComponent(tpsId)}&name=${encodeURIComponent(name)}`,
    );

    if (!statusRes.ok) {
      msg.textContent = statusRes.notConnected
        ? "Not connected to PRM — open the PRM extension to pair."
        : statusRes.error || "Could not reach PRM.";
      return;
    }

    renderPersonState(box, head, msg, tpsId, name, statusRes.data);
  }

  function renderPersonState(box, head, msg, tpsId, name, state) {
    // Reset dynamic content (keep the title).
    $$(".prm-chip, .prm-btn", head).forEach((el) => el.remove());
    msg.textContent = "";

    if (state.found) {
      head.appendChild(chip("found", "Found"));
      const status = state.extracted ? "extracted" : "not_extracted";
      const eChip = extractChipEl(status);
      head.appendChild(eChip);

      if (!state.extracted) {
        const btn = document.createElement("button");
        btn.className = "prm-btn";
        btn.textContent = "Extract";
        btn.addEventListener("click", () => runExtract(box, head, msg, tpsId, state.personUuid, btn, eChip));
        head.appendChild(btn);
      }
    } else {
      head.appendChild(chip("notfound", "Not Found"));
      const btn = document.createElement("button");
      btn.className = "prm-btn";
      btn.textContent = "Add to PRM";
      btn.addEventListener("click", () => runAdd(box, head, msg, tpsId, name, btn));
      head.appendChild(btn);
    }
  }

  async function runAdd(box, head, msg, tpsId, name, btn) {
    btn.disabled = true;
    msg.textContent = "Adding to PRM…";
    const details = document.getElementById("personDetails");
    const firstPhone = scrapePhones()[0] || undefined;
    const payload = {
      tpsId,
      firstName: (details && details.dataset.fn) || (name.split(/\s+/)[0] || name),
      lastName: (details && details.dataset.ln) || (name.split(/\s+/).slice(1).join(" ")),
      age: details && details.dataset.age ? details.dataset.age : undefined,
      city: details && details.dataset.city ? details.dataset.city : undefined,
      state: details && details.dataset.state ? details.dataset.state : undefined,
      phone: firstPhone,
    };
    const res = await apiFetch("/api/v1/tps/add", { method: "POST", body: payload });
    if (!res.ok) {
      btn.disabled = false;
      msg.textContent = res.error || "Failed to add.";
      return;
    }
    // Now Found — re-render with Extract available.
    renderPersonState(box, head, msg, tpsId, name, {
      found: true,
      personUuid: res.data.personUuid,
      extracted: false,
    });
    msg.textContent = "Added to PRM.";
  }

  async function runExtract(box, head, msg, tpsId, personUuid, btn, eChip) {
    btn.disabled = true;
    const busy = extractChipEl("extracting");
    eChip.replaceWith(busy);
    msg.textContent = "Extracting record…";

    const record = scrapePersonRecord(tpsId, personUuid);
    const res = await apiFetch("/api/v1/tps/extract", { method: "POST", body: record });

    if (!res.ok) {
      const back = extractChipEl("not_extracted");
      busy.replaceWith(back);
      btn.disabled = false;
      msg.textContent = res.error || "Extract failed.";
      return;
    }
    busy.replaceWith(extractChipEl("extracted"));
    btn.remove();
    msg.textContent = "Record extracted to PRM.";
  }

  // ── Entry point ────────────────────────────────────────────────────────────────

  function init() {
    const path = location.pathname;
    if (/^\/results/i.test(path)) {
      handleResultsPage();
    } else if (/^\/find\/person\//i.test(path)) {
      handlePersonPage();
    }
    console.log("[PRM] TruePeopleSearch content script ready.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

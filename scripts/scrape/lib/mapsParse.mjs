// scripts/scrape/lib/mapsParse.mjs
//
// Reading Google Maps: the results feed's links, a place URL, and a place's
// detail panel.
//
// ══ What the parser holds on to, and what it refuses to ═══════════════════
//
// Maps' class names are minified and change without notice; what does not
// change is what Google needs for accessibility and for its own actions:
// `data-item-id="address"`, `data-item-id="phone:tel:+1…"`,
// `data-item-id="authority"` (the website), `data-item-id="oloc"` (the plus
// code), the `role="img"` rating with an aria-label of "4.8 stars", the
// review histogram's `tr[aria-label]` "5 stars, 14 reviews", the hours'
// `button[jsaction*="openhours"][data-value]` "Monday, 7 a.m.–5 p.m.". The
// extractor reads those and only those; a field whose anchor is missing is
// null, not a guess from the surrounding text. `loaded` says whether the
// panel had enough to be a real detail page at all.
//
// The compass actor derives "claimed" from the ABSENCE of Google's "Own
// this business?" prompt. This parser does not: signed out, Maps rendered
// that prompt on none of the 22 panels the first live run opened, so
// absence would have called every one of them claimed. `claimed` is false
// when the prompt is seen and null otherwise (AGENTS.md: absence of a
// statement is not a statement).
//
// extractDetailInPage runs INSIDE the page (page.evaluate) and so must be
// self-contained: no imports, no closures. The check runs the same function
// over saved fixtures by loading them into Chrome with page.setContent.

/** Per-language sentences the extractor searches the panel's text for.
 *  Kept here, beside the parser, so a new language is one more entry. */
export const MARKERS = Object.freeze({
  en: {
    endOfList: ["You've reached the end of the list."],
    closedPermanently: ["Permanently closed"],
    closedTemporarily: ["Temporarily closed"],
    ownThisBusiness: ["Own this business?", "Claim this business"],
    price: ["Price"],
  },
  fr: {
    endOfList: ["Vous êtes arrivé à la fin de la liste.", "Vous avez atteint la fin de la liste."],
    closedPermanently: ["Définitivement fermé", "Fermé définitivement"],
    closedTemporarily: ["Temporairement fermé", "Fermé temporairement"],
    ownThisBusiness: ["Vous êtes le propriétaire de cet établissement ?", "Revendiquer cet établissement"],
    price: ["Prix"],
  },
  es: {
    endOfList: ["Has llegado al final de la lista."],
    closedPermanently: ["Cerrado permanentemente"],
    closedTemporarily: ["Cerrado temporalmente"],
    ownThisBusiness: ["¿Es tuyo este negocio?", "Reclamar este negocio"],
    price: ["Precio"],
  },
});

export function markersFor(lang = "en") {
  return MARKERS[lang] || MARKERS.en;
}

// ── URLs ─────────────────────────────────────────────────────────────────

/**
 * What a /maps/place/ URL carries: the place id (`!19sChIJ…`), the CID pair
 * (`!1s0x…:0x…`), the pin (`!3d<lat>!4d<lng>`), the name in the path.
 */
export function parsePlaceUrl(href) {
  const url = String(href ?? "");
  const name = decodeURIComponent((url.match(/\/maps\/place\/([^/]+)/) || [])[1] || "").replace(/\+/g, " ") || null;
  const placeId = (url.match(/!19s(ChIJ[0-9A-Za-z_-]+)/) || [])[1] || null;
  const cid = (url.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i) || [])[1] || null;
  const lat = Number((url.match(/!3d(-?\d+(?:\.\d+)?)/) || [])[1]);
  const lng = Number((url.match(/!4d(-?\d+(?:\.\d+)?)/) || [])[1]);
  return {
    href: url.split("?")[0],
    name,
    placeId,
    cid,
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
  };
}

/** The one place id a detail page is about: the ChIJ string that appears
 *  most often in its HTML. Nearby places appear once each; the page's own
 *  appears in every share link and data blob. */
export function placeIdFromHtml(html) {
  const counts = new Map();
  for (const m of String(html ?? "").matchAll(/ChIJ[0-9A-Za-z_-]{15,40}/g)) counts.set(m[0], (counts.get(m[0]) || 0) + 1);
  let best = null;
  for (const [id, n] of counts) if (!best || n > best.n) best = { id, n };
  return best && best.n >= 2 ? best.id : null;
}

/** Feed links → unique places, first sighting wins, in feed order. */
export function dedupeFeed(links = []) {
  const seen = new Set();
  const out = [];
  for (const raw of links) {
    const p = parsePlaceUrl(raw.href || raw);
    const key = p.placeId || p.cid || p.href;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ ...p, label: raw.label || p.name });
  }
  return out;
}

// ── In page ──────────────────────────────────────────────────────────────

/** Runs inside the page: the feed's place links and whether it has ended. */
export function readFeedInPage(markers) {
  const feed = document.querySelector('div[role="feed"]');
  const root = feed || document;
  const links = Array.from(root.querySelectorAll('a[href*="/maps/place/"]')).map((a) => ({ href: a.href, label: a.getAttribute("aria-label") || "" }));
  const text = (feed ? feed.innerText : document.body.innerText) || "";
  const ended = markers.endOfList.some((s) => text.includes(s));
  const noResults = !links.length && /can't find|no results|aucun résultat|no se encontr/i.test(text);
  return { links, ended, noResults, hasFeed: Boolean(feed), count: links.length };
}

/**
 * Runs inside the page: one place's detail panel as a flat record. Every
 * field null when its anchor is absent. `loaded` is the page's own word
 * that it was a detail panel: a title plus at least one of address, phone
 * or category.
 */
export function extractDetailInPage(markers) {
  const main = document.querySelector('div[role="main"]') || document.body;
  const q = (s) => Array.from(main.querySelectorAll(s));
  const attr = (el, a) => (el ? el.getAttribute(a) : null);
  const afterColon = (s) => (s ? String(s).replace(/^[^:]*:\s*/, "").trim() : null);
  const clean = (s) => (s ? String(s).replace(/\s+/g, " ").trim() : null);

  const h1 = main.querySelector("h1");
  const name = clean(h1 ? h1.textContent : attr(main, "aria-label"));
  const category = clean(q('button[jsaction*="category"]').map((e) => e.textContent).find((t) => t && t.trim())) || null;

  const addressEl = main.querySelector('[data-item-id="address"]');
  const address = addressEl ? clean(afterColon(attr(addressEl, "aria-label")) || addressEl.textContent) : null;

  const phoneEl = main.querySelector('[data-item-id^="phone:tel:"]');
  const phoneId = attr(phoneEl, "data-item-id");
  const phone = phoneId ? phoneId.replace(/^phone:tel:/, "").trim() : null;
  const phoneDisplay = phoneEl ? clean(afterColon(attr(phoneEl, "aria-label")) || phoneEl.textContent) : null;

  const siteEl = main.querySelector('a[data-item-id="authority"]');
  const websiteUrl = siteEl ? siteEl.href : null;

  const plusEl = main.querySelector('[data-item-id="oloc"]');
  const plusCode = plusEl ? clean(afterColon(attr(plusEl, "aria-label")) || plusEl.textContent) : null;

  let rating = null;
  let reviewCount = null;
  for (const el of q('[role="img"][aria-label], span[aria-label], div[aria-label]')) {
    const a = attr(el, "aria-label") || "";
    let m;
    if (rating === null && (m = a.match(/^\s*(\d+(?:[.,]\d)?)\s+(stars?|étoiles?|estrellas?)\s*$/i))) rating = parseFloat(m[1].replace(",", "."));
    if (reviewCount === null && (m = a.match(/^\s*([\d,.\s  ]+)\s+(reviews?|avis|reseñas?|opiniones?)\s*$/i))) reviewCount = parseInt(m[1].replace(/[^\d]/g, ""), 10);
    if (rating !== null && reviewCount !== null) break;
  }

  let starHistogram = null;
  for (const tr of q("tr[aria-label]")) {
    const m = (attr(tr, "aria-label") || "").match(/^\s*([1-5])\s+\S+,\s*([\d,.\s  ]+)/);
    if (!m) continue;
    starHistogram = starHistogram || [0, 0, 0, 0, 0];
    starHistogram[Number(m[1]) - 1] = parseInt(m[2].replace(/[^\d]/g, ""), 10) || 0;
  }

  let hours = q('[jsaction*="openhours"][data-value]').map((e) => clean(attr(e, "data-value"))).filter(Boolean);
  if (!hours.length) {
    hours = q('[aria-label$="Copy open hours"], [aria-label$="Copier les horaires"], [aria-label$="Copiar el horario"]')
      .map((e) => clean((attr(e, "aria-label") || "").replace(/,\s*(Copy open hours|Copier les horaires|Copiar el horario)\s*$/, "")))
      .filter(Boolean);
  }
  // Seven at most, and only if they look like day lines — the panel
  // sometimes repeats the table.
  const seenDays = new Set();
  hours = hours.filter((h) => {
    const day = h.split(",")[0].trim().toLowerCase();
    if (seenDays.has(day)) return false;
    seenDays.add(day);
    return true;
  }).slice(0, 7);

  const text = main.innerText || "";
  const closedPermanently = markers.closedPermanently.some((s) => text.includes(s));
  const closedTemporarily = !closedPermanently && markers.closedTemporarily.some((s) => text.includes(s));
  const ownMarker = markers.ownThisBusiness.some((s) => text.includes(s)) || Boolean(main.querySelector('[data-item-id="merchant"]'));

  let priceBracket = null;
  for (const el of q("[aria-label]")) {
    const a = attr(el, "aria-label") || "";
    if (markers.price.some((p) => a.startsWith(p + ":") || a.startsWith(p + " "))) {
      const v = afterColon(a) || a;
      if (/^[$€£]{1,4}$|^[$€£]/.test(v) || /\d/.test(v)) {
        priceBracket = clean(v);
        break;
      }
    }
  }

  const loaded = Boolean(name) && Boolean(address || phone || category);
  return {
    name,
    category,
    address,
    phone: phoneDisplay || phone,
    phoneE164Hint: phone,
    websiteUrl,
    plusCode,
    rating,
    reviewCount,
    starHistogram,
    hours: hours.length ? hours : null,
    businessStatus: closedPermanently ? "CLOSED_PERMANENTLY" : closedTemporarily ? "CLOSED_TEMPORARILY" : loaded ? "OPERATIONAL" : null,
    // Three-valued, and never "true from absence": the prompt is proof the
    // listing is UNCLAIMED; its absence proves nothing — on 2026-09-18,
    // signed out, Maps rendered it on none of 22 panels, claimed or not.
    claimed: ownMarker ? false : null,
    ownerPromptSeen: ownMarker,
    priceBracket,
    loaded,
  };
}

/** Node side: the record the writer receives, from the in-page extract
 *  plus what the URL and the feed link knew. */
export function assembleRecord({ detail, link = {}, finalUrl = "", html = "", term = null, location = null, tile = null }) {
  const fromUrl = parsePlaceUrl(finalUrl);
  const placeId = link.placeId || fromUrl.placeId || placeIdFromHtml(html);
  return {
    placeId,
    cid: link.cid || fromUrl.cid || null,
    name: detail.name || link.label || link.name || null,
    category: detail.category,
    address: detail.address,
    phone: detail.phone,
    websiteUrl: detail.websiteUrl,
    plusCode: detail.plusCode,
    latitude: link.latitude ?? fromUrl.latitude ?? null,
    longitude: link.longitude ?? fromUrl.longitude ?? null,
    rating: detail.rating,
    reviewCount: detail.reviewCount,
    starHistogram: detail.starHistogram,
    hours: detail.hours,
    businessStatus: detail.businessStatus,
    claimed: detail.claimed,
    priceBracket: detail.priceBracket,
    listingUrl: placeId ? `https://www.google.com/maps/place/?q=place_id:${encodeURIComponent(placeId)}` : (link.href || fromUrl.href || null),
    searchTerm: term,
    searchLocation: location,
    tile: tile ? tile.key : null,
    loaded: detail.loaded,
  };
}

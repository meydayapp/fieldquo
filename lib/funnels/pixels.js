// lib/funnels/pixels.js
//
// The ad-platform pixels on a public funnel page — Meta, TikTok, GA4 — as
// data the runner can inject, and the event it fires when a visitor becomes
// a lead.
//
// ── They were saved and never fired ────────────────────────────────────────
//
// The funnel builder has had a "Pixels" panel with three id fields since it
// shipped; the PATCH route stored them and the public API returned them
// under `funnel.pixels`, and FunnelRunner.js never read the key. A
// contractor who pasted a Meta pixel id so the ad account could optimise
// toward booked estimates got a field that saved, and an ad account that
// never heard a thing. That is the dead control this file closes.
//
// ── What gets injected, and what does not ──────────────────────────────────
//
// Only when the id is SET, and only when it has the SHAPE the platform
// issues. The ids are typed by the contractor with no validation on write
// (the route trims to 64 characters and stores whatever is left), and they
// end up inside a <script> on a public page. `validPixelIds` is therefore a
// strict allow-list — a Meta id is digits, a GA4 measurement id is G-XXXX, a
// TikTok id is upper-case alphanumerics — and anything else is dropped as if
// it were empty. A rejected id does not break the page; it just does not
// track, which is what a wrong id would have done on the platform's side
// anyway.
//
// The snippets are the platforms' own base tags, verbatim in effect: fbq init
// + PageView, gtag config, ttq load + page. No extra parameters, no advanced
// matching, no hashed email — the runner never passes the visitor's contact
// details to any of them.
//
// ── Consent ────────────────────────────────────────────────────────────────
//
// FieldQuo has no cookie-consent layer anywhere else: not on the marketing
// site, not on a contractor's /site/*, not on the booking or quote pages. A
// funnel with a pixel id was the first client-facing surface to set a
// third-party cookie, and it shipped with no banner.
//
// Since 2026-09-24 the COMPANY decides (Company.pixelConsentRequired, on
// Settings → Instant quotes → Ad tracking): off, the tags load as before;
// on, nothing in this file runs until the visitor accepts a short notice
// drawn in the company's colours (app/components/public/useAdTracking.js).
// Off by default because that is how every existing funnel behaves and a
// consent requirement is the company's legal call (Quebec's Law 25, GDPR for
// an EU visitor), not one FieldQuo can make for it.
//
// ── The Lead event ─────────────────────────────────────────────────────────
//
// Fired once, when the submit route has accepted the visitor's contact
// details — the moment FieldQuo itself records a lead. Meta's standard event
// is `Lead`; GA4's recommended one is `generate_lead`; TikTok's is
// `SubmitForm`. No value is attached: an instant-estimate range is a band
// the company chose, not a transaction, and reporting it as one would teach
// the ad platform to optimise toward the wrong number.

const META_ID = /^\d{5,20}$/;
const GA4_ID = /^(G|GT|AW)-[A-Z0-9]{4,20}$/;
const TIKTOK_ID = /^[A-Z0-9]{8,40}$/;

/**
 * The ids that are safe to put on the page, or null each. Anything that is
 * not a string of the platform's shape is treated as unset.
 */
export function validPixelIds(pixels) {
  const meta = typeof pixels?.meta === "string" ? pixels.meta.trim() : "";
  const ga4 = typeof pixels?.ga4 === "string" ? pixels.ga4.trim().toUpperCase() : "";
  const tiktok = typeof pixels?.tiktok === "string" ? pixels.tiktok.trim().toUpperCase() : "";
  return {
    meta: META_ID.test(meta) ? meta : null,
    ga4: GA4_ID.test(ga4) ? ga4 : null,
    tiktok: TIKTOK_ID.test(tiktok) ? tiktok : null,
  };
}

/**
 * The script tags to inject, in order, for the ids that passed. Each entry
 * is either { key, src } (an external script) or { key, inline } (code).
 * Empty when nothing is set — a funnel with no pixel ids loads nothing.
 */
export function pixelScripts(pixels) {
  const ids = validPixelIds(pixels);
  const out = [];
  if (ids.meta) {
    out.push({
      key: "meta-base",
      inline:
        "!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?" +
        "n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;" +
        "n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;" +
        "t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window," +
        "document,'script','https://connect.facebook.net/en_US/fbevents.js');" +
        // autoConfig off BEFORE init: Meta's "automatic configuration" reads
        // the page's buttons and form metadata on its own, and these pages
        // are forms full of a homeowner's name and number. Every event this
        // page sends is one we fire by hand with params we built.
        `fbq('set','autoConfig',false,'${ids.meta}');fbq('init','${ids.meta}');fbq('track','PageView');`,
    });
  }
  if (ids.ga4) {
    out.push({
      key: "ga4-src",
      src: `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ids.ga4)}`,
    });
    out.push({
      key: "ga4-init",
      inline:
        "window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}" +
        `window.gtag=window.gtag||gtag;gtag('js',new Date());gtag('config','${ids.ga4}');`,
    });
  }
  if (ids.tiktok) {
    out.push({
      key: "tiktok-base",
      inline:
        "!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];" +
        'ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"],' +
        "ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};" +
        "for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);" +
        "ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};" +
        'ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";' +
        "ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};" +
        'var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;' +
        "var a=document.getElementsByTagName(\"script\")[0];a.parentNode.insertBefore(o,a)};" +
        `ttq.load('${ids.tiktok}');ttq.page();}(window,document,'ttq');`,
    });
  }
  return out;
}

// ── The events after PageView ──────────────────────────────────────────────
//
// Three moments, named once in Meta's vocabulary and mapped to the other two
// platforms' words for the same thing:
//
//   ViewContent  the visitor started — past the first screen of a funnel,
//                or picked a service on the instant estimate.
//   Lead         the submit route ACCEPTED their details — never before, so
//                a refused submission is never a conversion.
//   Schedule     a visit was booked from the estimate's confirmation.
//
// `params` come from the SERVER (lib/tracking/attribution.js pixelParams): a
// trade or channel key and, for an estimate the visitor was shown, a bucket
// name like "5k_10k". Nothing typed by the visitor is ever passed here, and no
// figure — `value`/`currency` are never set (see the Lead note above). The
// filter below re-applies the same closed shape so a caller cannot widen it.
//
// `eventId` is the lead's own id on Lead, passed as Meta's eventID so that a
// server-side Conversions API send of the same lead, if one is ever wired,
// de-duplicates against this browser event rather than counting twice.
const EVENT_PARAM_KEYS = new Set(["content_category", "estimate_bucket"]);
const EVENT_NAMES = {
  ViewContent: { ga4: "funnel_start", tiktok: "ViewContent" },
  Lead: { ga4: "generate_lead", tiktok: "SubmitForm" },
  Schedule: { ga4: "schedule_visit", tiktok: "Schedule" },
};

/**
 * Fire one event on whichever pixels are on the page. Returns the names
 * fired, so a check can assert on them without a browser. Every call is
 * guarded: a pixel whose script failed to load (or was never loaded because
 * the visitor declined) is a missing global, never an exception.
 */
export function firePixelEvent(
  pixels,
  event,
  { params = {}, eventId = null } = {},
  win = typeof window !== "undefined" ? window : null,
) {
  const names = EVENT_NAMES[event];
  const ids = validPixelIds(pixels);
  const fired = [];
  if (!win || !names) return fired;
  // Two keys, and values that must carry a letter — so neither `value`,
  // `currency`, `em`/`ph` (Meta's matching keys) nor a bare figure like
  // "4500" can ride along, whatever a caller passes.
  const clean = {};
  for (const [k, v] of Object.entries(params || {})) {
    if (EVENT_PARAM_KEYS.has(k) && typeof v === "string" && /^(?=[a-z0-9_]*[a-z])[a-z0-9_]{1,40}$/.test(v)) clean[k] = v;
  }
  if (ids.meta && typeof win.fbq === "function") {
    try {
      if (eventId) win.fbq("track", event, clean, { eventID: String(eventId) });
      else win.fbq("track", event, clean);
      fired.push(`meta:${event}`);
    } catch {
      /* the platform's script threw; nothing of ours depends on it */
    }
  }
  if (ids.ga4 && typeof win.gtag === "function") {
    try {
      win.gtag("event", names.ga4, { method: "funnel", ...clean });
      fired.push(`ga4:${names.ga4}`);
    } catch {
      /* same */
    }
  }
  if (ids.tiktok && win.ttq && typeof win.ttq.track === "function") {
    try {
      win.ttq.track(names.tiktok, clean);
      fired.push(`tiktok:${names.tiktok}`);
    } catch {
      /* same */
    }
  }
  return fired;
}

/**
 * The Lead event — kept under its original name because the funnel runner
 * and scripts/check-marketing-controls.mjs call it.
 */
export function fireLeadEvents(pixels, win = typeof window !== "undefined" ? window : null, opts = {}) {
  return firePixelEvent(pixels, "Lead", opts, win);
}

/**
 * Put the base tags on the page, once each. React Strict Mode double-runs
 * effects in development, and a second fbq init is a double PageView on the
 * ad account — the `data-fq-pixel` marker is what makes the guard survive
 * that. Returns the keys injected by this call.
 */
export function injectPixelScripts(pixels, doc = typeof document !== "undefined" ? document : null) {
  const added = [];
  if (!doc) return added;
  for (const tag of pixelScripts(pixels)) {
    if (doc.querySelector(`script[data-fq-pixel="${tag.key}"]`)) continue;
    const el = doc.createElement("script");
    el.setAttribute("data-fq-pixel", tag.key);
    el.async = true;
    if (tag.src) el.src = tag.src;
    else el.text = tag.inline;
    doc.head.appendChild(el);
    added.push(tag.key);
  }
  return added;
}

// ── The company's own ids, and one funnel's ─────────────────────────────────
//
// A company sets its pixels once (Settings → Instant quotes → Ad tracking)
// and its instant estimate and every funnel it runs use them. A funnel that
// set its OWN id in the builder's Pixels panel keeps it — that panel predates
// the company setting, and a contractor running two ad accounts uses it on
// purpose — per platform, so a funnel with only its own TikTok id still gets
// the company's Meta pixel.
export function effectivePixels(funnel = {}, company = {}) {
  const pick = (a, b) =>
    typeof a === "string" && a.trim() ? a : typeof b === "string" && b.trim() ? b : null;
  return {
    meta: pick(funnel?.metaPixelId, company?.metaPixelId),
    tiktok: pick(funnel?.tiktokPixelId, company?.tiktokPixelId),
    ga4: pick(funnel?.ga4Id, company?.ga4Id),
  };
}

// ── Validation on WRITE ─────────────────────────────────────────────────────
//
// validPixelIds above is the READ-side allow-list and stays loose enough
// (Meta 5-20 digits) that nothing already saved stops firing. Writes are held
// to what the platforms actually issue, and a wrong one is REFUSED with the
// field named: the commonest paste is the whole `fbq('init', '…')` line or
// the dataset's name, and storing that meant a field that said "saved" and a
// pixel that never loaded.
//
//   Meta Pixel / dataset id  15 or 16 digits
//   Google tag               G-XXXXXXX (GA4) or AW-123456789 (Google Ads)
//   TikTok pixel             15-25 upper-case letters and digits
const WRITE_RULES = {
  metaPixelId: { re: /^\d{15,16}$/, norm: (v) => v.replace(/\s+/g, "") },
  ga4Id: { re: /^(G-[A-Z0-9]{4,20}|AW-\d{6,15})$/, norm: (v) => v.replace(/\s+/g, "").toUpperCase() },
  tiktokPixelId: { re: /^[A-Z0-9]{15,25}$/, norm: (v) => v.replace(/\s+/g, "").toUpperCase() },
};
export const TRACKING_ID_FIELDS = Object.freeze(Object.keys(WRITE_RULES));

/**
 * { data, errors } for the id fields present in `body`. An empty string or
 * null clears the field; a field absent from `body` is left alone. `errors`
 * lists the fields refused, and callers refuse the whole write when it is
 * non-empty — half-saving a form is how a control appears to work.
 */
export function validateTrackingIdsForWrite(body = {}) {
  const data = {};
  const errors = [];
  const b = body && typeof body === "object" ? body : {};
  for (const field of TRACKING_ID_FIELDS) {
    if (!Object.hasOwn(b, field)) continue;
    const raw = b[field];
    if (raw === null || raw === "") {
      data[field] = null;
      continue;
    }
    if (typeof raw !== "string" || raw.length > 64) {
      errors.push(field);
      continue;
    }
    const v = WRITE_RULES[field].norm(raw.trim());
    if (!v) data[field] = null;
    else if (WRITE_RULES[field].re.test(v)) data[field] = v;
    else errors.push(field);
  }
  return { data, errors };
}

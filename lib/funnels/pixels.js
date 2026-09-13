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
// FieldQuo has no cookie-consent layer anywhere: not on the marketing site,
// not on a contractor's /site/*, not on the booking or quote pages. Nothing
// else on a client-facing surface sets a third-party cookie today, so there
// was nothing to read the posture from. A funnel with a pixel id is the first
// surface that does, and this file adds no banner of its own — a consent
// mechanism is a product decision with legal weight (Quebec's Law 25, GDPR
// for an EU visitor) and belongs to the company publishing the funnel, not
// to a helper that injects a tag. The report that shipped this says so; the
// funnel builder's pixel panel says so beside the fields.
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
        `fbq('init','${ids.meta}');fbq('track','PageView');`,
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

/**
 * Fire the platforms' lead event on whichever pixels are on the page.
 * Returns the names fired, so a check can assert on them without a browser.
 * Every call is guarded: a pixel whose script failed to load is a missing
 * global, never an exception in the visitor's thank-you step.
 */
export function fireLeadEvents(pixels, win = typeof window !== "undefined" ? window : null) {
  const ids = validPixelIds(pixels);
  const fired = [];
  if (!win) return fired;
  if (ids.meta && typeof win.fbq === "function") {
    try {
      win.fbq("track", "Lead");
      fired.push("meta:Lead");
    } catch {
      /* the platform's script threw; the lead is already saved */
    }
  }
  if (ids.ga4 && typeof win.gtag === "function") {
    try {
      win.gtag("event", "generate_lead", { method: "funnel" });
      fired.push("ga4:generate_lead");
    } catch {
      /* same */
    }
  }
  if (ids.tiktok && win.ttq && typeof win.ttq.track === "function") {
    try {
      win.ttq.track("SubmitForm");
      fired.push("tiktok:SubmitForm");
    } catch {
      /* same */
    }
  }
  return fired;
}

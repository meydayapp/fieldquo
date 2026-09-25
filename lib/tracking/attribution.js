// lib/tracking/attribution.js
//
// What a landing on a company's funnel or instant estimate is allowed to
// leave behind, decided on the SERVER. The browser posts whatever the URL
// carried (lib/tracking/landing.js readLanding); this file is the boundary
// between that and the FunnelVisit row the company's report groups by and the
// lead's "Came from" line prints.
//
// ══ Refuse the shape, keep the words ═══════════════════════════════════════
//
// A utm_campaign is written by whoever built the link — often Meta itself,
// substituting {{campaign.name}}, which is a name the contractor typed in Ads
// Manager with spaces, capitals and an ampersand in it. Lower-casing it or
// squeezing it through the product analytics' 64-character UTM pattern would
// report "Spring Roofs & Gutters" as nothing at all. So a tag here is kept as
// written, minus control characters and markup characters, bounded to 100.
// It is only ever rendered as React text, never into HTML or a URL.
//
// An unsubstituted Meta placeholder ("{{campaign.name}}", from someone opening
// the tagged link by hand) is dropped: it is not a campaign.
//
// ══ The click id ═══════════════════════════════════════════════════════════
//
// Meta appends `fbclid` to every ad click. Its pixel stores it in the _fbc
// cookie as `fb.1.<ms the click landed>.<fbclid>`, and that string — not the
// raw fbclid — is what Meta's own tools match on. It is kept in that shape so
// a later export or Conversions API integration can use it without guessing
// the landing time after the fact. Its presence is also the one honest signal
// that a visit came from an ad click: Facebook's in-app browser sends no
// referrer at all.

import { cleanClickNetwork, foldReferrerHost, trafficSource } from "@/lib/analytics/product/events";
import { RESERVED_SUBDOMAINS } from "@/lib/site/subdomain";

const TAG_MAX = 100;
const CLICK_ID = /^[A-Za-z0-9_-]{8,500}$/;
const HOST = /^[a-z0-9.-]{1,100}$/;
/** FieldQuo's own hosts — the app, the marketing site, previews, a laptop. */
const OWN_HOST = /^(fieldquo\.com|www\.fieldquo\.com|app\.fieldquo\.com|localhost)$|\.vercel\.app$/;
/** A contractor's FieldQuo-hosted site: <subdomain>.fieldquo.com. */
const TENANT_SITE = /^[a-z0-9-]+\.fieldquo\.com$/;

/** A tag as written, made safe to store and render, or null. */
export function cleanTag(value) {
  if (typeof value !== "string") return null;
  const v = value
    .normalize("NFC")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>"'`\\]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, TAG_MAX)
    .trim();
  if (!v) return null;
  if (/^\{\{.*\}\}$/.test(v)) return null;
  return v;
}

export function cleanClickId(value) {
  return typeof value === "string" && CLICK_ID.test(value) ? value : null;
}

/** Meta's _fbc value for a click id that landed at `landedAtMs`, or null. */
export function fbcFor(fbclid, landedAtMs) {
  const id = cleanClickId(fbclid);
  const ms = Number(landedAtMs);
  if (!id || !Number.isInteger(ms) || ms <= 0) return null;
  return `fb.1.${ms}.${id}`;
}

/**
 * The referring host, folded to one row per network, or:
 *   "website"  the company's own FieldQuo-hosted site linked here;
 *   null       absent, malformed, or FieldQuo itself (an in-app hop is not a
 *              source).
 */
export function referrerHostOf(value) {
  if (typeof value !== "string" || !value) return null;
  let host = value.trim().toLowerCase();
  if (host.includes("/")) {
    try {
      host = new URL(host.includes("://") ? host : `https://${host}`).hostname;
    } catch {
      return null;
    }
  }
  host = host.replace(/^www\./, "");
  if (!HOST.test(host) || !host.includes(".")) return null;
  if (OWN_HOST.test(host) || OWN_HOST.test(`www.${host}`)) return null;
  if (TENANT_SITE.test(host)) {
    // help., book., quote. … are FieldQuo's, not a contractor's site.
    return RESERVED_SUBDOMAINS.has(host.split(".")[0]) ? null : "website";
  }
  return foldReferrerHost(host);
}

/**
 * A landing as the browser posted it (readLanding's shape), cleaned into the
 * FunnelVisit columns. `now` is the server's clock for the _fbc timestamp —
 * the browser's clock is not evidence of anything.
 */
export function cleanLanding(raw = {}, now = new Date()) {
  const r = raw && typeof raw === "object" ? raw : {};
  const fbclid = cleanClickId(r.fbclid);
  const clickNetwork = cleanClickNetwork(
    fbclid ? "facebook" : cleanClickId(r.gclid) ? "google_ads" : cleanClickId(r.ttclid) ? "tiktok" : null,
  );
  const referrerHost = referrerHostOf(r.referrer);
  const utmSource = cleanTag(r.utm_source);
  const utmMedium = cleanTag(r.utm_medium);
  const landing = {
    utmSource,
    utmMedium,
    utmCampaign: cleanTag(r.utm_campaign),
    utmContent: cleanTag(r.utm_content),
    utmTerm: cleanTag(r.utm_term),
    clickNetwork,
    fbc: fbcFor(fbclid, now.getTime()),
    referrerHost,
  };
  // The one-word source the report groups by. The company's own site is its
  // own answer — trafficSource would call a FieldQuo host "direct", and "my
  // website sent me 40 estimate requests" is the thing the contractor wants
  // to read.
  landing.source =
    !clickNetwork && !utmSource && referrerHost === "website"
      ? "website"
      : trafficSource({
          referrerHost: referrerHost === "website" ? null : referrerHost,
          utmSource: utmSource ? utmSource.toLowerCase() : null,
          utmMedium,
          clickNetwork,
        });
  return landing;
}

/**
 * The JSON a lead carries, built from the SERVER's visit row. Only the fields
 * that say something; `landedAt` so "came from this campaign three weeks
 * before they asked" is readable.
 */
export function attributionFromVisit(visit) {
  if (!visit) return null;
  const out = { source: visit.source || "direct" };
  for (const k of ["utmSource", "utmMedium", "utmCampaign", "utmContent", "utmTerm", "clickNetwork", "fbc", "referrerHost"]) {
    if (visit[k]) out[k] = visit[k];
  }
  if (visit.startedAt) out.landedAt = new Date(visit.startedAt).toISOString();
  return out;
}

/**
 * A coarse size for an estimate the visitor was SHOWN, for the ad platform's
 * Lead event — "5k_10k", never a figure. Computed from the midpoint so a
 * range straddling a boundary lands in one bucket. Null for anything that is
 * not a finite positive range: absence is not the smallest bucket.
 *
 * Deliberately in the company's own currency units with no currency attached
 * — a bucket is for grouping leads in the company's own ad account, not a
 * transaction value, and it is never sent as Meta's `value` parameter (that
 * would teach the campaign to optimise toward a number the contractor has not
 * agreed with anyone).
 */
const BUCKETS = [
  [1000, "under_1k"],
  [5000, "1k_5k"],
  [10000, "5k_10k"],
  [25000, "10k_25k"],
  [50000, "25k_50k"],
  [Infinity, "50k_plus"],
];
export function estimateBucket(low, high) {
  const lo = Number(low);
  const hi = Number(high);
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || lo <= 0 || hi < lo) return null;
  const mid = (lo + hi) / 2;
  for (const [ceiling, name] of BUCKETS) if (mid < ceiling) return name;
  return null;
}
export const ESTIMATE_BUCKETS = Object.freeze(BUCKETS.map(([, n]) => n));

/**
 * The custom parameters for a pixel event, built on the server so the browser
 * forwards them untouched. Closed keys, closed values: a trade/channel KEY and
 * a bucket NAME. No name, email, phone, address, figure or currency ever goes
 * in here — scripts check the output against hostile input.
 */
// A trade/channel key starts with a letter — so a figure ("4500") can never
// pass as a category, whoever calls this.
const PARAM_KEY = /^[a-z][a-z0-9_]{0,39}$/;
export function pixelParams({ category = null, bucket = null } = {}) {
  const out = {};
  if (typeof category === "string" && PARAM_KEY.test(category)) out.content_category = category;
  if (typeof bucket === "string" && ESTIMATE_BUCKETS.includes(bucket)) out.estimate_bucket = bucket;
  return out;
}

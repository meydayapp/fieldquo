// lib/tracking/landing.js
//
// The browser half of ad attribution for a company's public funnels — what a
// tagged link carries in, and the tagged link itself. Its one import is
// ./adParams, which has none of its own, so the funnel runner, the instant
// estimate and the /app link builder can all pull it in without dragging
// server code into a client bundle. The server half, which decides what is
// kept, is lib/tracking/attribution.js.
//
// ══ The link "Facebook needs" ══════════════════════════════════════════════
//
// Meta Ads Manager asks for two things on an ad: a Website URL and, under
// Tracking, "URL parameters". A contractor who pastes the plain funnel link
// gets visits FieldQuo can only call "facebook" (from the click id Meta
// appends) with no campaign. The link builder therefore hands out both:
//
//   · the full link with utm_* filled in from what the contractor typed —
//     right for a boosted post, a link-in-bio, a flyer QR code;
//   · the URL-parameters string with Meta's own dynamic placeholders
//     ({{campaign.name}}, {{ad.name}}), which Meta substitutes per click, so
//     every campaign the contractor ever runs arrives named without them
//     building a link per ad. That string is NOT URL-encoded: Meta expects the
//     braces raw in that field and substitutes them before encoding.
//
// A visitor who opens the link with the placeholders unsubstituted (someone
// testing it by hand) arrives with a literal "{{campaign.name}}";
// attribution.js drops that rather than reporting a campaign by that name.
//
// ══ One Ads Manager string for every company (25 September 2026) ══════════
//
// The company string used to carry two macros — {{campaign.name}} in
// utm_campaign and {{ad.name}} in utm_content — so an ad set was invisible,
// a campaign renamed in Ads Manager split in two, and an Instagram placement
// arrived as "facebook" because the source was typed into the string. It is
// now META_URL_PARAMETERS from ./adParams, verbatim: the string the owner
// pastes for FieldQuo's own ads, which adds the campaign / ad set / ad ids,
// {{placement}} and {{site_source_name}}. utm_source stays "facebook" for
// every placement on purpose; the network is read from site_source_name on
// the server (attribution.js), never from utm_source. readLanding reads
// every one of those names (AD_QUERY_PARAMS) beside the ones it always read,
// so a link built before this change lands exactly as it did.

import { AD_QUERY_PARAMS, AD_RAW_MAX, META_URL_PARAMETERS } from "./adParams";

/** The query parameters a landing is read for, in the order they are stored. */
export const LANDING_PARAMS = Object.freeze([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
  "ttclid",
]);

/**
 * What a landing carried: the parameters above (raw strings, bounded) and the
 * referrer's HOST — never its path or query, which can hold another site's
 * tokens. Unsanitised beyond length: the server is the boundary.
 */
export function readLanding(search = "", referrer = "") {
  const out = {};
  try {
    const q = new URLSearchParams(typeof search === "string" ? search : "");
    for (const k of LANDING_PARAMS) {
      const v = q.get(k);
      if (v) out[k] = v.slice(0, 500);
    }
    // Meta's ids, placement and site_source_name (and the explicit
    // campaign_name / adset_name / ad_name some link builders send). Raw and
    // bounded like the rest: cleanAdParams on the server is the boundary.
    for (const k of AD_QUERY_PARAMS) {
      if (out[k]) continue;
      const v = q.get(k);
      if (v) out[k] = v.slice(0, AD_RAW_MAX);
    }
  } catch {
    /* a malformed query string is no landing data, not an error */
  }
  try {
    if (referrer) out.referrer = new URL(referrer).hostname.slice(0, 100);
  } catch {
    /* same */
  }
  return out;
}

/** Defaults for the builder's first paint: a paid Facebook/Instagram ad. */
export const TRACKING_LINK_DEFAULTS = Object.freeze({
  source: "facebook",
  medium: "paid_social",
  campaign: "",
  content: "",
});

/**
 * A tag value as a link carries it: lower-case words joined by underscores,
 * at most 64 characters. "Spring Roofs 2026!" becomes "spring_roofs_2026" —
 * repaired rather than refused, because the person typing is filling in a
 * form in /app and a refusal over an exclamation mark helps nobody.
 */
export function tagValue(value) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

/**
 * The full tagged link, or null when the base is not an http(s) URL. Empty
 * tags are left off rather than sent as `utm_campaign=` — an empty value
 * would group every untagged visit under a blank campaign.
 */
export function buildTrackingLink(baseUrl, tags = {}) {
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const pairs = [
    ["utm_source", tagValue(tags.source)],
    ["utm_medium", tagValue(tags.medium)],
    ["utm_campaign", tagValue(tags.campaign)],
    ["utm_content", tagValue(tags.content)],
  ];
  for (const [k, v] of pairs) {
    if (v) url.searchParams.set(k, v);
    else url.searchParams.delete(k);
  }
  return url.toString();
}

/**
 * The string for Meta Ads Manager's "URL parameters" field: always
 * META_URL_PARAMETERS, the same for every company and every page, whatever
 * the manual tag fields in the link builder say. Those fields build a link
 * for a flyer or an email; a Meta ad's network is read from
 * site_source_name, which a hand-picked utm_source would only contradict.
 * The argument is accepted and ignored so an older caller keeps working.
 */
export function metaUrlParameters() {
  return META_URL_PARAMETERS;
}

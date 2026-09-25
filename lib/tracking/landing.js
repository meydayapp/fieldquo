// lib/tracking/landing.js
//
// The browser half of ad attribution for a company's public funnels — what a
// tagged link carries in, and the tagged link itself. No imports, so the
// funnel runner, the instant estimate and the /app link builder can all pull
// it in without dragging server code into a client bundle. The server half,
// which decides what is kept, is lib/tracking/attribution.js.
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
 * The string for Meta Ads Manager's "URL parameters" field: the source and
 * medium the contractor chose, and Meta's own placeholders for the campaign
 * and the ad, substituted by Meta per click.
 */
export function metaUrlParameters(tags = {}) {
  const source = tagValue(tags.source) || TRACKING_LINK_DEFAULTS.source;
  const medium = tagValue(tags.medium) || TRACKING_LINK_DEFAULTS.medium;
  return `utm_source=${source}&utm_medium=${medium}&utm_campaign={{campaign.name}}&utm_content={{ad.name}}`;
}

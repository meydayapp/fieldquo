// lib/tracking/describe.js
//
// How a lead's `attribution` (lib/tracking/attribution.js attributionFromVisit)
// reads in /app. No imports — the leads board is a client component and must
// not pull the analytics route catalogue in to print one line.

/** Display names for the one-word sources; anything else prints as stored. */
const SOURCE_NAMES = {
  facebook: "Facebook",
  instagram: "Instagram",
  google: "Google",
  google_ads: "Google Ads",
  tiktok: "TikTok",
  bing: "Bing",
  bing_ads: "Bing Ads",
  linkedin: "LinkedIn",
  youtube: "YouTube",
  x: "X",
  pinterest: "Pinterest",
  reddit: "Reddit",
  email: "Email",
  chatgpt: "ChatGPT",
};

/** A source key as a person reads it. "website" and "direct" are translated by the caller. */
export function sourceName(source) {
  if (typeof source !== "string" || !source) return "";
  return SOURCE_NAMES[source] || source;
}

/**
 * The parts of an attribution the lead drawer prints, or null when there is
 * nothing to say. `adClick` is true only when the network's own click id was
 * on the link — the one signal that the visit was an ad click rather than a
 * post someone shared.
 */
export function describeAttribution(attr) {
  if (!attr || typeof attr !== "object") return null;
  const source = typeof attr.source === "string" ? attr.source : null;
  if (!source) return null;
  return {
    source,
    campaign: typeof attr.utmCampaign === "string" ? attr.utmCampaign : null,
    medium: typeof attr.utmMedium === "string" ? attr.utmMedium : null,
    content: typeof attr.utmContent === "string" ? attr.utmContent : null,
    adClick: Boolean(attr.fbc) || attr.clickNetwork === "google_ads" || attr.clickNetwork === "tiktok",
    referrerHost: typeof attr.referrerHost === "string" ? attr.referrerHost : null,
  };
}

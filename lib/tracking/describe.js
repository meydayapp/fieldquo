// lib/tracking/describe.js
//
// How a lead's `attribution` (lib/tracking/attribution.js attributionFromVisit)
// reads in /app. Its one import, ./adParams, has none of its own — the leads
// board is a client component and must not pull the analytics route
// catalogue in to print one line.

import { cleanAdParams, decodeAdValue, expandAd } from "./adParams";

/** Display names for the one-word sources; anything else prints as stored. */
const SOURCE_NAMES = {
  facebook: "Facebook",
  instagram: "Instagram",
  messenger: "Messenger",
  threads: "Threads",
  audience_network: "Audience Network",
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
 *
 * The campaign and the ad are read the way the campaign report reads them:
 * Meta's own names from `attribution.ad` when the landing had them, else the
 * utm_* decoded ("spring+roofs" is "spring roofs"). A campaign Meta sent by
 * id only prints its id — the report names what is missing.
 */
export function describeAttribution(attr) {
  if (!attr || typeof attr !== "object") return null;
  const source = typeof attr.source === "string" ? attr.source : null;
  if (!source) return null;
  const stored = expandAd(attr.ad);
  const legacy = cleanAdParams({
    utm_campaign: typeof attr.utmCampaign === "string" ? attr.utmCampaign : undefined,
    utm_content: typeof attr.utmContent === "string" ? attr.utmContent : undefined,
  });
  return {
    source,
    campaign: stored?.campaignName || legacy.campaignName || stored?.campaignId || legacy.campaignId || null,
    medium: decodeAdValue(attr.utmMedium),
    content: stored?.adName || legacy.adName || null,
    adClick: Boolean(attr.fbc) || attr.clickNetwork === "google_ads" || attr.clickNetwork === "tiktok",
    referrerHost: typeof attr.referrerHost === "string" ? attr.referrerHost : null,
  };
}

// lib/agency/channels.js
//
// Where a lead came from, in the agency's words, and which ad brought it.
// Pure: every input is a column the loader already read.
//
// ══ The channels ═══════════════════════════════════════════════════════════
//
//   facebook_ad    a Messenger thread that began on an ad, a Meta lead form,
//                  or a landing that carried Meta's ad click
//   instagram_ad   the same, on Instagram
//   whatsapp_ad    a click-to-WhatsApp ad
//   google_ads     a landing that carried Google's ad click (gclid), or a
//                  utm_medium of cpc/paid on a Google source
//   agency_funnel  posted by the agency's own funnel (POST /api/v1/marketing/
//                  leads) — the agency said so with its key — unless it
//                  posted a gclid with it, which makes it google_ads
//   website        the company's own forms: self-quote, instant estimate,
//                  embed form, lead funnel, web chat — with no ad signal
//   referral       a referral link or a landing tagged as one
//   organic        everything else: a phone call, a message that did not
//                  start on an ad, a lead typed in by staff
//
// The order below is the order of trust. The agency's own key is the
// strongest statement; Meta's own ad marker on a conversation is next (it is
// Meta saying so, lib/leads/qualification.js); then the server-held landing
// (lib/tracking/attribution.js — never the submit body). A lead nobody can
// place is "organic", which here means "not shown to be paid" — the same
// conservative reading lib/analytics/adFunnel.js makes of a thread.

import { adIdentityOf } from "@/lib/tracking/attribution";

export const CHANNELS = Object.freeze([
  "facebook_ad",
  "instagram_ad",
  "whatsapp_ad",
  "google_ads",
  "agency_funnel",
  "website",
  "referral",
  "organic",
]);

/** Channels whose spend is Meta's. */
export const META_CHANNELS = Object.freeze(["facebook_ad", "instagram_ad", "whatsapp_ad"]);
/** Channels whose spend is Google's. */
export const GOOGLE_CHANNELS = Object.freeze(["google_ads"]);

/** A `source` filter as the API takes it → the channels it selects. */
export const SOURCE_FILTERS = Object.freeze({
  meta: META_CHANNELS,
  google: GOOGLE_CHANNELS,
  paid: [...META_CHANNELS, ...GOOGLE_CHANNELS],
  ...Object.fromEntries(CHANNELS.map((c) => [c, [c]])),
});

const WEBSITE_SOURCES = new Set(["self_quote", "self_quote_kitchen", "instant_quote", "embed_form", "funnel", "web_chat", "booking_page"]);
const PAID_MEDIUM = /^(cpc|ppc|paid|paidsocial|paid_social|paid-social|ads?|display)$/i;

const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);

/** Meta's click id out of the stored _fbc string ("fb.1.<ms>.<fbclid>"). */
export function fbclidFromFbc(fbc) {
  if (typeof fbc !== "string") return null;
  const m = fbc.match(/^fb\.\d\.\d+\.([A-Za-z0-9_-]{8,500})$/);
  return m ? m[1] : null;
}

/**
 * @param lead    { source, attribution, metaLeadId, metaCampaignId }
 * @param thread  the conversation the lead came from, if any:
 *                { platform, origin: "ad"|"organic"|null, adReferral }
 */
export function channelOf(lead, thread = null) {
  const source = typeof lead?.source === "string" ? lead.source : "";
  if (source === "agency_funnel") {
    // Except when the agency posted Google's click id with it. That is a
    // Google Ads lead relayed by the agency (Zapier's "Google Ads: New Lead
    // Form Entry" → "FieldQuo: Create Lead", docs/AGENCY-GOOGLE-ADS.md), and
    // its spend is Google's: filed under the agency's funnel it fell out of
    // every Google cost-per-lead. An fbclid is not treated the same way yet —
    // the agency's own funnel is usually a Meta ad, and moving those is a
    // decision about the agency's reports, not a fix.
    const posted = obj(lead?.attribution);
    if (posted && (typeof posted.gclid === "string" || posted.clickNetwork === "google_ads")) return "google_ads";
    return "agency_funnel";
  }

  const t = obj(thread);
  if (t && (t.origin === "ad" || obj(t.adReferral))) {
    if (t.platform === "instagram") return "instagram_ad";
    if (t.platform === "whatsapp") return "whatsapp_ad";
    return "facebook_ad";
  }

  const a = obj(lead?.attribution);
  if (source === "meta_lead_form" || lead?.metaLeadId) {
    return a?.source === "instagram" ? "instagram_ad" : "facebook_ad";
  }

  if (a) {
    const ad = adIdentityOf(a);
    const paidMedium = PAID_MEDIUM.test(String(a.utmMedium || ""));
    if (a.clickNetwork === "google_ads" || a.source === "google_ads" || a.gclid) return "google_ads";
    if (paidMedium && /google/i.test(String(a.utmSource || a.source || ""))) return "google_ads";
    const metaSignal = a.clickNetwork === "facebook" || Boolean(a.fbc) || Boolean(ad?.campaignId || ad?.adId) || (paidMedium && /facebook|instagram|^fb$|^ig$|meta/i.test(String(a.utmSource || a.source || "")));
    if (metaSignal) {
      const net = ad?.network || a.source;
      if (net === "instagram") return "instagram_ad";
      return "facebook_ad";
    }
    if (a.source === "referral" || /^referral$/i.test(String(a.utmSource || a.utmMedium || ""))) return "referral";
  }
  if (source === "referral") return "referral";
  if (WEBSITE_SOURCES.has(source) || source.startsWith("funnel:")) return "website";
  return "organic";
}

/**
 * The ad that brought the lead, as far as it is known. Every field null when
 * unknown — never a guess.
 */
export function adAttributionOf(lead, thread = null) {
  const a = obj(lead?.attribution) || {};
  const ad = adIdentityOf(a);
  const referral = obj(thread?.adReferral);
  const metaCampaignId = lead?.metaCampaignId || null;
  const out = {
    campaignId: metaCampaignId || ad?.campaignId || a.campaignId || null,
    campaignName: lead?.metaCampaignName || ad?.campaignName || a.campaignName || null,
    adsetId: ad?.adsetId || a.adsetId || null,
    adsetName: ad?.adsetName || a.adsetName || null,
    adId: ad?.adId || (typeof referral?.adId === "string" ? referral.adId : null) || a.adId || null,
    adName: ad?.adName || (typeof referral?.adTitle === "string" ? referral.adTitle : null) || a.adName || null,
    fbclid: fbclidFromFbc(a.fbc) || (typeof a.fbclid === "string" ? a.fbclid : null),
    gclid: typeof a.gclid === "string" ? a.gclid : null,
    utmSource: a.utmSource || null,
    utmMedium: a.utmMedium || null,
    utmCampaign: a.utmCampaign || null,
    utmContent: a.utmContent || null,
    utmTerm: a.utmTerm || null,
    // "Louise replied to an ad." — when the conversation began on the ad.
    adRepliedAt: referral && typeof referral.at === "string" ? referral.at : null,
  };
  for (const k of Object.keys(out)) if (typeof out[k] === "string") out[k] = out[k].slice(0, 200);
  return out;
}

/** The key a lead groups under in the per-campaign split, or null. */
export function campaignKeyOf(attr) {
  if (!attr) return null;
  if (attr.campaignId) return `id:${attr.campaignId}`;
  const name = attr.campaignName || attr.utmCampaign;
  return name ? `name:${String(name).trim().toLowerCase()}` : null;
}

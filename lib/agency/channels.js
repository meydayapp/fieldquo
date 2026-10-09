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
//                  leads) — the agency said so with its key
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
  if (source === "agency_funnel") return "agency_funnel";

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

// ══ The channel's thread, as channelOf reads it ════════════════════════════
//
// A lead's conversation as channelOf needs it: the platform, whether Meta
// says it began on an ad, and the ad referral. lib/agency/leadFacts.js built
// this inline; the Leads board (GET /api/leads) needs the same three facts to
// place a lead the same way, so it is here once rather than twice.

/**
 * The thread a lead came from: the EARLIEST of its conversations — the one
 * the first message arrived on. Null when there are none.
 */
export function originThreadOf(threads) {
  const list = (Array.isArray(threads) ? threads : []).filter((t) => t && typeof t === "object");
  if (!list.length) return null;
  const at = (t) => {
    const d = new Date(t.firstInboundAt || t.createdAt || 0).getTime();
    return Number.isFinite(d) ? d : 0;
  };
  return list.slice().sort((a, b) => at(a) - at(b))[0];
}

/**
 * { platform, origin, adReferral } for channelOf, from a MessageThread row
 * ({ adReferral, leadCapture }) and its channel's platform.
 */
export function threadViewOf(thread, platform = null) {
  if (!thread || typeof thread !== "object") return null;
  const q = obj(obj(thread.leadCapture)?.qualification);
  return {
    platform: platform || null,
    origin: q?.origin === "ad" ? "ad" : obj(thread.adReferral) ? "ad" : null,
    adReferral: thread.adReferral ?? null,
  };
}

// ══ The Leads board's source filter (2026-10-09) ═══════════════════════════
//
// The owner asked for one control on the board: All, Agency funnel,
// Facebook/Instagram ads, Google Ads, Website, Referral, Phone, Other. Every
// option is a set of the CHANNELS above, so the board, the agency API and the
// Marketing results page place a lead in the same place — with one split
// channelOf never needed: "organic" becomes the phone and the rest, because
// the board's reader asks "did they ring us?" and the agency's does not.
//
//   meta    Facebook, Instagram and WhatsApp ads — META_CHANNELS. A
//           click-to-WhatsApp ad is a Meta ad, bought in the same Ads
//           Manager, so it is counted where its money is.
//   phone   organic, taken by the phone line (PHONE_SOURCES)
//   other   organic and not the phone: a message that did not start on an
//           ad, a lead typed in by staff, an import, a source this version
//           does not know

/** Sources that mean "they rang", for the phone bucket. */
export const PHONE_SOURCES = Object.freeze(["phone_agent", "phone_agent_recovered"]);

/** The board's filter options, in the order the control lists them. */
export const LEAD_SOURCE_FILTERS = Object.freeze(["agency", "meta", "google", "website", "referral", "phone", "other"]);

/** Every channel channelOf can return → the board's bucket for it. */
const BUCKET_OF_CHANNEL = Object.freeze({
  agency_funnel: "agency",
  facebook_ad: "meta",
  instagram_ad: "meta",
  whatsapp_ad: "meta",
  google_ads: "google",
  website: "website",
  referral: "referral",
  organic: "other",
});

/**
 * The board's bucket for a lead whose channel channelOf already decided. An
 * unknown channel is "other" — a lead never falls out of every option.
 */
export function sourceFilterOf(channel, source) {
  const bucket = Object.prototype.hasOwnProperty.call(BUCKET_OF_CHANNEL, channel) ? BUCKET_OF_CHANNEL[channel] : "other";
  if (bucket === "other" && typeof source === "string" && PHONE_SOURCES.includes(source)) return "phone";
  return bucket;
}

/** Does a lead in `bucket` pass the board's filter `filter` ("" = all)? */
export function passesSourceFilter(bucket, filter) {
  if (!filter || !LEAD_SOURCE_FILTERS.includes(filter)) return true;
  return bucket === filter;
}

// ══ The leads that came from marketing ══════════════════════════════════════
//
// What a marketing-agency TEAM MEMBER is shown on Marketing › Leads
// (GET /api/marketing/leads): the paid channels, the agency's own funnel, and
// the company's web forms its ads land on. Referral and organic — a
// neighbour's word, a phone call, a staff-typed lead — are not marketing's,
// and the agency member has no reason to read them, even pseudonymised.
export const MARKETING_CHANNELS = Object.freeze([...META_CHANNELS, ...GOOGLE_CHANNELS, "agency_funnel", "website"]);

// ══ Which agency key sent it ════════════════════════════════════════════════
//
// POST /api/v1/marketing/leads records the key on the lead's intake
// (intake.agencyKey: { id, name }) since 2026-10-09, so the board can say
// WHICH agency sent a lead. Older leads say "Agency" and no name — absence of
// a name is not a name, and none is invented for them.

/** The key's name as the board may print it: plain text, at most 80 chars. */
export function cleanAgencyKeyName(name) {
  if (typeof name !== "string") return null;
  const s = name
    .normalize("NFC")
    // Control characters, zero-width and bidi overrides (a name that renders
    // reversed on the board is a name that lies), and angle brackets.
    .replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return s ? s.slice(0, 80) : null;
}

/** The { id, name } a new agency lead's intake records about its key. */
export function agencyKeyStamp(key) {
  const id = typeof key?.id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(key.id) ? key.id : null;
  const name = cleanAgencyKeyName(key?.name);
  return id || name ? { id, name } : null;
}

/**
 * The board's "Agency" badge for a lead: null unless the lead came from the
 * agency's funnel; { name } otherwise, name null when the lead predates the
 * stamp or the stamp is damaged.
 */
export function agencyBadgeOf(lead) {
  if (!lead || typeof lead !== "object" || lead.source !== "agency_funnel") return null;
  const stamp = obj(obj(lead.intake)?.agencyKey);
  return { name: stamp ? cleanAgencyKeyName(stamp.name) : null };
}

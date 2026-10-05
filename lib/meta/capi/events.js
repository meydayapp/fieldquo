// lib/meta/capi/events.js
//
// What FieldQuo tells Meta about a lead, as pure functions: which stages a
// lead has reached, and the exact server event for each. No database, no
// network — scripts/check-meta-capi.mjs executes every rule here.
//
// ══ Three kinds, three of Meta's integrations ══════════════════════════════
//
//   crm        A Facebook/Instagram LEAD FORM lead (LeadRequest.metaLeadId).
//              Meta's "Conversions API for CRM" (Conversion Leads): the
//              lead's stages as the company's CRM sees them, keyed by Meta's
//              own lead id. action_source "system_generated", custom_data
//              { lead_event_source, event_source: "crm" } — Meta's payload
//              specification, read 2026-10-05.
//   messaging  A click-to-Messenger / click-to-Instagram CONVERSATION.
//              Meta's "Conversions API for Business Messaging":
//              action_source "business_messaging", messaging_channel, and the
//              page-scoped / Instagram-scoped id of the person.
//   website    A FieldQuo funnel or instant-estimate lead that arrived from an
//              ad click (an _fbc on the visit). action_source "website", and
//              the SAME event_id the browser pixel used, so Meta counts one.
//
// ══ The stages and when each fires (crm) ═══════════════════════════════════
//
//   Raw Lead            on import — every lead-form lead.
//   Qualified           the lead is warm or hot AND, when it came through a
//                       conversation, that conversation's tier is `lead`.
//   Disqualified        the conversation's tier is tap_only or not_relevant,
//                       or a person marked the lead lost as "not a real
//                       inquiry", or deleted it as "not a lead" (that one is
//                       written at the delete — lib/meta/capi/capture.js —
//                       because the row is gone afterwards).
//   Appointment Booked  an appointment exists for the lead's client or quote.
//   Quote Sent          the lead's quote was sent.
//   Converted           the lead's quote was accepted, or its conversation
//                       was marked won — with the value and currency.
//
// Event names are FIXED ENGLISH strings, never translated: Meta treats
// `event_name` as the stage's identity, and the stage a campaign optimises
// toward is picked by that name in Events Manager. Renaming one orphans every
// campaign pointed at it.
//
// ══ When a stage happened ══════════════════════════════════════════════════
//
// A stage with a timestamp of its own (created, sent, accepted, an
// appointment's creation) is sent with it. Qualified and Disqualified have
// none — temperature and tier are recomputed in place — so they carry the
// moment FieldQuo first observed them, which is what Meta's field means
// ("when the lead stage update event is updated by your CRM"). Those
// observed stages are only emitted while the lead is inside Meta's 28-day
// optimisation window: telling Meta in December that a September lead
// qualified "today" would be a stage 90 days after the lead, which the
// Conversion Leads model ignores, dressed up as fresh.
//
// Every time is clamped to be no earlier than the lead itself — Meta discards
// an event that precedes the lead's generation.

import { effectiveTier } from "@/lib/leads/qualification";
import { sha256Hex } from "./hash";

/** The source name Meta asks for in custom_data.lead_event_source. */
export const LEAD_EVENT_SOURCE = "FieldQuo";

/** Meta refuses an event_time more than this many days before the upload. */
export const MAX_EVENT_AGE_DAYS = 7;
/** The window inside which a stage counts for Conversion Leads. */
export const STAGE_WINDOW_DAYS = 28;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Our stage key → Meta's event_name, per kind. Order is the funnel order. */
export const CRM_STAGES = Object.freeze([
  ["raw_lead", "Raw Lead"],
  ["qualified", "Qualified"],
  ["disqualified", "Disqualified"],
  ["appointment_booked", "Appointment Booked"],
  ["quote_sent", "Quote Sent"],
  ["converted", "Converted"],
]);
export const MESSAGING_STAGES = Object.freeze([
  ["lead_submitted", "LeadSubmitted"],
  ["purchase", "Purchase"],
]);
export const WEBSITE_STAGES = Object.freeze([
  ["lead", "Lead"],
  ["schedule", "Schedule"],
  ["purchase", "Purchase"],
]);
const NAMES = {
  crm: Object.fromEntries(CRM_STAGES),
  messaging: Object.fromEntries(MESSAGING_STAGES),
  website: Object.fromEntries(WEBSITE_STAGES),
};
const RANK = {
  crm: Object.fromEntries(CRM_STAGES.map(([k], i) => [k, i])),
  messaging: Object.fromEntries(MESSAGING_STAGES.map(([k], i) => [k, i])),
  website: Object.fromEntries(WEBSITE_STAGES.map(([k], i) => [k, i])),
};

export function eventNameFor(kind, stage) {
  return NAMES[kind]?.[stage] || null;
}
/** Funnel position of a stage — the sender sends earlier stages first. */
export function stageRank(kind, stage) {
  const r = RANK[kind]?.[stage];
  return Number.isInteger(r) ? r : 99;
}

/** Tiers that are never a lead, for any kind. */
export const DISQUALIFYING_TIERS = Object.freeze(["tap_only", "not_relevant"]);
const WARM = new Set(["warm", "hot"]);

/** The lost reason a person picks for "this was never an enquiry". */
export const NOT_A_LEAD_LOST_REASON = "not_real_inquiry";

const toDate = (v) => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
};
const later = (a, b) => (a.getTime() >= b.getTime() ? a : b);

/** A money figure Meta can take: a finite non-negative number, 2 dp. Pure. */
export function moneyValue(v) {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "object" && typeof v.toNumber === "function" ? v.toNumber() : Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100) / 100;
}

/** ISO 4217, upper-case, or null. Pure. */
export function currencyCode(v) {
  const c = typeof v === "string" ? v.trim().toUpperCase() : "";
  return /^[A-Z]{3}$/.test(c) ? c : null;
}

/** Meta's lead id: 15-17 digits (Meta's own words), or null. Pure. */
export function cleanMetaLeadId(v) {
  const s = String(v ?? "").trim();
  return /^\d{15,17}$/.test(s) ? s : null;
}

/**
 * The conversion facts a quote carries, or null when it was not accepted.
 * Pure. `acceptedTotal` (what the client actually approved, add-ons
 * included) wins over `total` (what was quoted).
 */
export function acceptedSale(quote, currency) {
  if (!quote || quote.status !== "accepted") return null;
  return {
    at: toDate(quote.acceptedAt),
    value: moneyValue(quote.acceptedTotal ?? quote.total),
    currency: currencyCode(currency),
  };
}

/**
 * Every CRM stage a lead-form lead has reached, as { stage, at, value?,
 * currency? }. Pure.
 *
 * @param p.lead        { id, metaLeadId, createdAt, temperature, lostReason }
 * @param p.tier        the effective tier of the conversation the lead came
 *                      through, or null for a form lead with no conversation
 * @param p.notALead    a person marked that conversation "not a lead"
 * @param p.quote       the lead's quote { status, sentAt, acceptedAt, total,
 *                      acceptedTotal } or null
 * @param p.appointmentAt  the earliest appointment for the lead's client or
 *                      quote, or null
 * @param p.wonAt       the conversation's outcome "won" time, or null
 * @param p.currency    the company's billing currency
 * @param p.now         the observation time
 */
export function crmStagesForLead({ lead, tier = null, notALead = false, quote = null, appointmentAt = null, wonAt = null, currency = null, now = new Date() }) {
  const born = toDate(lead?.createdAt);
  if (!lead?.id || !born || !cleanMetaLeadId(lead.metaLeadId)) return [];
  const observed = toDate(now) || new Date();
  const inWindow = observed.getTime() - born.getTime() <= STAGE_WINDOW_DAYS * DAY_MS;
  const at = (d) => later(toDate(d) || observed, born);
  const out = [{ stage: "raw_lead", at: born }];

  const disqualified =
    DISQUALIFYING_TIERS.includes(tier) || lead.lostReason === NOT_A_LEAD_LOST_REASON || Boolean(notALead);
  if (disqualified) {
    if (inWindow) out.push({ stage: "disqualified", at: at(observed) });
    // A disqualified lead reports nothing further: a lead somebody called
    // "not a lead" that later shows a sent quote is a data-entry mix-up, and
    // telling Meta both would teach it the opposite of what was meant.
    return out;
  }
  if (inWindow && WARM.has(lead.temperature) && (tier === null || tier === "lead")) {
    out.push({ stage: "qualified", at: at(observed) });
  }
  const appt = toDate(appointmentAt);
  if (appt && appt.getTime() >= born.getTime()) out.push({ stage: "appointment_booked", at: appt });
  const sent = toDate(quote?.sentAt);
  if (sent) out.push({ stage: "quote_sent", at: at(sent) });
  const sale = acceptedSale(quote, currency);
  if (sale) {
    out.push({ stage: "converted", at: at(sale.at || observed), value: sale.value, currency: sale.currency });
  } else if (toDate(wonAt)) {
    out.push({ stage: "converted", at: at(wonAt), value: null, currency: null });
  }
  return out;
}

/** The conversation's effective tier and marks, from its leadCapture. Pure. */
export function threadVerdict(leadCapture) {
  const c = leadCapture && typeof leadCapture === "object" && !Array.isArray(leadCapture) ? leadCapture : {};
  const q = c.qualification && typeof c.qualification === "object" ? c.qualification : null;
  return {
    tier: effectiveTier(q),
    origin: q?.origin === "ad" ? "ad" : "organic",
    notALead: Boolean(c.notALead),
  };
}

/** "messenger" | "instagram" for a thread's platform, or null. Pure. */
export function messagingChannelFor(platform) {
  if (platform === "facebook" || platform === "messenger") return "messenger";
  if (platform === "instagram") return "instagram";
  return null;
}

/**
 * The Business Messaging events a conversation has earned. Pure.
 *
 * Nothing at all unless the conversation started on an AD (a live referral,
 * or the history marker the classifier found) on Messenger or Instagram, a
 * tier has been decided, and nobody marked it "not a lead". A tap_only or
 * not_relevant conversation sends nothing — those are exactly the accidental
 * taps the owner wants Meta to stop counting, and Business Messaging has no
 * "disqualified" event to say so with.
 *
 * @param p.thread   { id, createdAt, platform, adReferral, leadCapture, temperature }
 * @param p.leadTemperature  the linked lead's temperature, when the thread has none
 * @param p.quote    the client's accepted quote for this conversation, or null
 */
export function messagingStagesForThread({ thread, leadTemperature = null, quote = null, currency = null, now = new Date() }) {
  const born = toDate(thread?.createdAt);
  if (!thread?.id || !born || !messagingChannelFor(thread.platform)) return [];
  const v = threadVerdict(thread.leadCapture);
  const fromAd = Boolean(thread.adReferral) || v.origin === "ad";
  if (!fromAd || v.notALead || !v.tier || DISQUALIFYING_TIERS.includes(v.tier)) return [];
  const observed = toDate(now) || new Date();
  const inWindow = observed.getTime() - born.getTime() <= STAGE_WINDOW_DAYS * DAY_MS;
  const out = [];
  const temp = thread.temperature || leadTemperature;
  if (v.tier === "lead" && WARM.has(temp) && inWindow) out.push({ stage: "lead_submitted", at: later(observed, born) });
  const sale = acceptedSale(quote, currency);
  if (sale && sale.value !== null && sale.currency) {
    out.push({ stage: "purchase", at: later(sale.at || observed, born), value: sale.value, currency: sale.currency });
  }
  return out;
}

const unix = (d) => Math.floor(toDate(d).getTime() / 1000);

/** The CRM server event for one stage. Pure. */
export function crmEvent({ leadId, metaLeadId, stage, at, contact = {}, value = null, currency = null }) {
  const name = eventNameFor("crm", stage);
  const lid = cleanMetaLeadId(metaLeadId);
  if (!name || !lid || !leadId) return null;
  const custom = { lead_event_source: LEAD_EVENT_SOURCE, event_source: "crm" };
  if (stage === "converted" && moneyValue(value) !== null && currencyCode(currency)) {
    custom.value = moneyValue(value);
    custom.currency = currencyCode(currency);
  }
  return {
    event_name: name,
    event_time: unix(at),
    event_id: `${leadId}:${stage}`,
    action_source: "system_generated",
    user_data: { lead_id: lid, ...contact },
    custom_data: custom,
  };
}

/**
 * The Business Messaging server event. Pure. `scopedUserId` is the PSID
 * (Messenger) or IGSID (Instagram) — MessageThread.participantExternalId;
 * `ownerId` the Page id or the Instagram professional account id —
 * MessagingChannel.externalId.
 */
export function messagingEvent({ threadId, channel, ownerId, scopedUserId, stage, at, value = null, currency = null }) {
  const name = eventNameFor("messaging", stage);
  if (!name || !threadId || !ownerId || !scopedUserId) return null;
  let user_data;
  if (channel === "messenger") user_data = { page_id: String(ownerId), page_scoped_user_id: String(scopedUserId) };
  else if (channel === "instagram") user_data = { instagram_business_account_id: String(ownerId), ig_sid: String(scopedUserId) };
  else return null;
  const ev = {
    event_name: name,
    event_time: unix(at),
    event_id: `${threadId}:${stage}`,
    action_source: "business_messaging",
    messaging_channel: channel,
    user_data,
  };
  if (stage === "purchase") {
    if (moneyValue(value) === null || !currencyCode(currency)) return null;
    ev.custom_data = { value: moneyValue(value), currency: currencyCode(currency) };
  }
  return ev;
}

/**
 * The website server event. Pure. `eventId` must be the id the browser pixel
 * used (the lead id for Lead, the booking id for Schedule) — that pair is what
 * Meta de-duplicates on, with the event name.
 *
 * Meta requires client_user_agent and event_source_url on a website event;
 * without both this returns null rather than an event Meta would refuse.
 */
export function websiteEvent({ eventId, stage, at, eventSourceUrl, userAgent, ip = null, fbc = null, fbp = null, contact = {}, value = null, currency = null }) {
  const name = eventNameFor("website", stage);
  if (!name || !eventId || typeof userAgent !== "string" || !userAgent.trim() || !eventSourceUrl) return null;
  const user_data = { client_user_agent: userAgent.slice(0, 512), ...contact };
  if (ip) user_data.client_ip_address = String(ip).slice(0, 64);
  if (fbc) user_data.fbc = String(fbc);
  if (fbp) user_data.fbp = String(fbp);
  const ev = {
    event_name: name,
    event_time: unix(at),
    event_id: String(eventId),
    action_source: "website",
    event_source_url: String(eventSourceUrl).slice(0, 2048),
    user_data,
  };
  if (stage === "purchase") {
    if (moneyValue(value) === null || !currencyCode(currency)) return null;
    ev.custom_data = { value: moneyValue(value), currency: currencyCode(currency) };
  }
  return ev;
}

/** The outbox key for an event. Website Lead/Schedule use the browser's id. */
export function outboxEventId(kind, { leadId, threadId, stage, eventId }) {
  if (kind === "crm") return `${leadId}:${stage}`;
  if (kind === "messaging") return `${threadId}:${stage}`;
  return String(eventId);
}

/**
 * The JSON Meta receives for a batch. Exactly JSON.stringify, except that
 * user_data.lead_id goes out as a bare NUMBER — Meta's specification shows it
 * as one, and a 15-17 digit id is past JavaScript's safe integer range, so it
 * is kept as a string until here and spliced in as digits rather than ever
 * being parsed into a Number (which would silently change the last digits).
 */
export function serialiseEvents(events) {
  return JSON.stringify(events).replace(/"lead_id":"(\d{15,17})"/g, '"lead_id":$1');
}

/** sha256 of the stored payload — MetaConversionEvent.payloadHash. Pure. */
export function payloadHash(payload) {
  return sha256Hex(JSON.stringify(payload));
}

/** Is this event_time still inside Meta's 7-day window at `now`? Pure. */
export function withinUploadWindow(eventTime, now = new Date()) {
  const t = toDate(eventTime);
  const n = toDate(now);
  if (!t || !n) return false;
  return n.getTime() - t.getTime() <= MAX_EVENT_AGE_DAYS * DAY_MS - 60 * 60 * 1000;
}

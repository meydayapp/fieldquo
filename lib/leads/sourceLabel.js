// lib/leads/sourceLabel.js
//
// A lead's `source` as a person reads it.
//
// LeadRequest.source is a machine word — "instant_quote", "self_quote_kitchen",
// "phone_agent", "funnel:facebook" — and the lead drawer printed it raw beside
// the date, so a reviewer read "· instant_quote" on the one screen that is
// supposed to tell them where an enquiry came from.
//
// ONE map, covering every value a lead is written with today (createScoredLead
// and its callers: the instant estimate, the self-quote form and kitchen
// designer, the client portal, the embed form, the phone agent and its
// recovery, a staff-typed lead, the CSV import, lead funnels, Meta lead forms,
// and the AI employee — whose chat callbacks carry the channel's own source,
// lib/messaging/platforms.js SOURCE_FOR_PLATFORM). The label is the app's
// existing sentence for that channel wherever one already exists, so the
// drawer says what the rest of the app says in all nine languages — the
// traffic report's "Instant estimate" and "Lead funnel", the quote's "Typed
// by staff", the review queue's phone line, the messaging platform names. Only
// the channels nothing named yet have keys of their own (app.leads.source.*).
//
// A value this map does not know reads as "A source this version doesn't
// know" (the createdVia screen's sentence for the same situation) — never the
// raw column. The embed form (app/api/leads/public) accepts a `source` from
// the contractor's own HTML, so an unrecognised word is possible there. That
// fallback is the reason a gap here is SILENT, and why the coverage is
// asserted rather than trusted: nothing throws, nothing logs, and a reviewer
// simply reads a sentence that tells them nothing.
//
// Pure, no React: scripts/check-approval-screens.mjs executes it, and its
// section 6 DERIVES the set of sources a lead can carry — the qualifier maps,
// the messaging platform map, every literal at a createScoredLead call site,
// the demo seed's own lead specs, and three writers recorded by name — then
// holds this map to it in both directions. A source with no label fails, and
// so does a label for a source nothing produces.

export const LEAD_SOURCE_LABEL_KEY = Object.freeze({
  instant_quote: "app.traffic.instantEstimate",
  manual: "app.quotes.createdVia.staff",
  phone_agent: "app.reviews.source.phoneCall",
  phone_agent_recovered: "app.reviews.source.phoneCall",
  funnel: "app.traffic.funnel",
  web_chat: "app.messages.platform.web",
  sms_chat: "app.messages.platform.sms",
  // NOT_ASKED_BY_SOURCE (lib/leads/qualifiers.js) names this one too.
  sms: "app.messages.platform.sms",
  meta_messenger: "app.messages.platform.facebook",
  meta_instagram: "app.messages.platform.instagram",
  meta_whatsapp: "app.messages.platform.whatsapp",
  email: "app.messages.platform.email",
  self_quote: "app.leads.source.self_quote",
  self_quote_kitchen: "app.leads.source.self_quote_kitchen",
  client_portal: "app.leads.source.client_portal",
  embed_form: "app.leads.source.embed_form",
  meta_lead_form: "app.leads.source.meta_lead_form",
  imported: "app.leads.source.imported",
  ai_employee: "app.leads.source.ai_employee",
  // Posted by the company's marketing agency from its own funnel, with the
  // agency key (POST /api/v1/marketing/leads, lib/agency/api.js).
  agency_funnel: "app.leads.source.agency_funnel",
  // Booked a visit on the company's booking page with no enquiry before it
  // (lib/booking/bookingLead.js, 2026-10-05).
  booking_page: "app.leads.source.booking_page",
  // A general contractor asked this company to price a job, and a member
  // accepted it into FieldQuo (lib/subRequests/, 2026-10-06).
  gc_request: "app.leads.source.gc_request",

  // ── Two words that were already in the database and not in this map ──────
  //
  // Both found as live rows (34 each, across the ten demo companies), both
  // reading as "A source this version doesn't know" on the lead drawer.
  // Neither is a new channel, so neither gets a new sentence: the label is
  // the one the rest of the app already prints for that channel, which is
  // this map's whole rule.

  // Word of mouth. lib/demo/seedContent.js's lead specs write it, and the
  // embed form (app/api/leads/public) takes a `source` straight from the
  // contractor's own HTML, so a real company can post it too. The Leads
  // board's source filter has had a "Referral" bucket all along
  // (lib/agency/channels.js, app/app/leads/page.js) — the drawer was the only
  // screen that could not name what the filter was filtering, so it reuses
  // that bucket's label rather than inventing a second word for one thing.
  referral: "app.agencyMetrics.source.referral",

  // The BOOKING source for a visit the receptionist arranged
  // (lib/voice/availability.js bookSlot's `source` default), not a lead
  // source — the word a lead is written with is "phone_agent", and
  // lib/booking/bookingLead.js's bookingLeadSource() maps one onto the other
  // precisely so this never reaches a LeadRequest again.
  //
  // It is here because it already did. Rows written before that mapping
  // existed still hold it, lib/demo/seedContent.js's own header records the
  // same fix, and no backfill can reach a word the embed form may post
  // tomorrow. An alias costs one line and tells the truth about the channel;
  // leaving it out would keep telling 34 real leads' worth of nothing. Same
  // label as phone_agent for the same reason phone_agent_recovered shares it:
  // a reviewer is being told where the enquiry came from, not which internal
  // word recorded it.
  phone_assistant: "app.reviews.source.phoneCall",
});

/** Said for a source word this map does not know. */
export const UNKNOWN_LEAD_SOURCE_KEY = "app.quotes.createdVia.unknown";

/** The i18n key for a lead source; null only when there is no source at all. */
export function leadSourceLabelKey(source) {
  if (typeof source !== "string" || !source) return null;
  // "funnel:facebook" — a funnel stamped with the channel it ran on
  // (lib/funnels/ingest.js). The channel is on the attribution line below it.
  const base = source.startsWith("funnel:") ? "funnel" : source;
  return Object.prototype.hasOwnProperty.call(LEAD_SOURCE_LABEL_KEY, base)
    ? LEAD_SOURCE_LABEL_KEY[base]
    : UNKNOWN_LEAD_SOURCE_KEY;
}

/** The label through `t`; "" when the lead has no source. */
export function leadSourceLabel(t, source) {
  const key = leadSourceLabelKey(source);
  return key ? t(key) : "";
}

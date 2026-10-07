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
// the contractor's own HTML, so an unrecognised word is possible there.
//
// Pure, no React: scripts/check-approval-screens.mjs executes it.

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

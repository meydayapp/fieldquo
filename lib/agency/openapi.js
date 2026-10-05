// lib/agency/openapi.js
//
// The marketing-agency API's OpenAPI 3.1 description, built FROM the code it
// describes — the event list (lib/agency/events.js), the lead row's keys
// (lib/agency/leadRow.js), the metric definitions (lib/agency/metrics.js),
// the periods and source filters — so the reference cannot list a field the
// API stopped sending or miss one it started to. Served as JSON at
// /developers/marketing-api/openapi.json and rendered by the docs page.

import { EVENTS, EVENT_DESCRIPTIONS } from "@/lib/agency/events";
import { LEAD_ROW_KEYS, CONTACT_KEYS, MONEY_KEYS, APPOINTMENT_OUTCOMES } from "@/lib/agency/leadRow";
import { DEFINITIONS, METRIC_KEYS } from "@/lib/agency/metrics";
import { PERIOD_KEYS } from "@/lib/agency/periods";
import { SOURCE_FILTERS, CHANNELS } from "@/lib/agency/channels";
import { SCOPE_READ, SCOPE_WRITE_LEADS } from "@/lib/agency/keys";
import { RATE_LIMIT } from "@/lib/agency/apiAuth";
import { LOST_REASONS } from "@/lib/leads/pipeline";
import { TIERS } from "@/lib/leads/qualification";

/** What each lead-row field means — one line each, for the reference. */
export const LEAD_FIELD_DOCS = Object.freeze({
  ref: "Stable pseudonymous reference (lr_…). Random; never derived from a phone or email. The same for the life of the lead.",
  displayRef: "The reference as people read it: L- and its last four characters.",
  firstName: "First name only.",
  firstContactAt: "When the person first got in touch (their first message, or the lead's creation).",
  leadCreatedAt: "When the lead was created in FieldQuo.",
  channel: `Where the lead came from: ${CHANNELS.join(", ")}.`,
  campaignId: "Ad campaign id, where known.",
  campaignName: "Ad campaign name, where known.",
  adsetId: "Ad set id, where known.",
  adsetName: "Ad set name, where known.",
  adId: "Ad id, where known (a Messenger ad referral carries one).",
  adName: "Ad name or title, where known.",
  fbclid: "Meta click id, where the landing carried one.",
  gclid: "Google click id, where known.",
  utmSource: "utm_source.",
  utmMedium: "utm_medium.",
  utmCampaign: "utm_campaign.",
  utmContent: "utm_content.",
  utmTerm: "utm_term.",
  adRepliedAt: "When the person replied to a click-to-message ad.",
  tier: `Conversation tier: ${TIERS.join(", ")}. A form, call or staff-typed lead is "lead".`,
  temperature: "cold, warm or hot (FieldQuo's lead score band).",
  qualified: "true when warm or hot, or when the lead went on to book a visit, receive a quote or close.",
  qualifiedAt: "When the lead first became warm or hot; null when qualified only by a later stage or before this was recorded.",
  firstResponseAt: "The company's first reply in the conversation the lead came from.",
  speedToLeadMinutes: "Minutes from the first message to the first reply.",
  stage: "Furthest stage: lead, qualified, appointment, quote_sent, won, or lost.",
  pipelineStatus: "The company's own pipeline column: new, contacted, converted (won) or lost.",
  appointmentBookedAt: "When the in-person (sales) appointment was booked.",
  appointmentAt: "The appointment's date and time.",
  appointmentOutcome: `${APPOINTMENT_OUTCOMES.join(", ")}. FieldQuo records no no-show status: a past appointment nobody marked is "unmarked".`,
  appointmentType: "\"estimate\" — the sales appointment is the on-site estimate visit.",
  requestedVisitFrom: "Start of the visit window asked for (by the agency or the homeowner).",
  requestedVisitTo: "End of that window.",
  quoteCreatedAt: "When the quote was created.",
  quoteSentAt: "When the quote was sent.",
  quoteViewedAt: "When the client first opened the quote.",
  quoteDeclinedAt: "When the client declined the quote.",
  quoteDeclineReason: "The client's reason, with emails, phone numbers, postal codes and street addresses blanked unless contact details are shared.",
  wonAt: "When the quote was accepted (the lead became a client).",
  closedWithoutVisit: "true when won with no in-person appointment before it.",
  invoicedAt: "When the first invoice for the job was issued.",
  paidAt: "When the job's invoices were all paid.",
  jobCompletedAt: "When the job was marked complete.",
  moneyShared: "Whether the company shares job values with its agency.",
  currency: "Currency of the amounts (null when job values are not shared).",
  quoteAmount: "Quote total (null when job values are not shared).",
  wonAmount: "Accepted value (null when not shared or not won).",
  invoicedAmount: "Invoiced total (null when not shared).",
  collectedAmount: "Paid so far (null when not shared).",
  serviceRequested: "The service the lead asked for.",
  serviceSold: "The service(s) on the accepted quote.",
  postalCode: "US: the 5-digit ZIP. Canada: the first three characters (FSA). Full code only when contact details are shared. Other countries: null.",
  postalCountry: "US or CA.",
  lostReason: `When lost: ${LOST_REASONS.join(", ")}.`,
  contactsShared: "Whether the company shares contact details with its agency.",
  fullName: "Full name — only when contact details are shared, else null.",
  phone: "Phone — only when contact details are shared, else null.",
  email: "Email — only when contact details are shared, else null.",
  updatedAt: "The latest change to anything on the row.",
});

const leadSchema = () => ({
  type: "object",
  description: "One lead, privacy-safe. Every field is always present; a field the company does not share is null.",
  properties: Object.fromEntries(LEAD_ROW_KEYS.map((k) => [k, { description: LEAD_FIELD_DOCS[k] || "" }])),
});

const refusal = { type: "object", properties: { error: { type: "string" }, code: { type: "string" } }, required: ["error", "code"] };
const errors = {
  401: { description: "No key, an unknown key, or a revoked key (code key_revoked).", content: { "application/json": { schema: { $ref: "#/components/schemas/Refusal" } } } },
  403: { description: "The key lacks the permission this needs (code scope_missing).", content: { "application/json": { schema: { $ref: "#/components/schemas/Refusal" } } } },
  429: { description: `More than ${RATE_LIMIT} requests a minute with this key (code rate_limited; Retry-After header).`, content: { "application/json": { schema: { $ref: "#/components/schemas/Refusal" } } } },
};
const json = (schema, description = "OK") => ({ description, content: { "application/json": { schema } } });
const periodParams = [
  { name: "period", in: "query", schema: { type: "string", enum: PERIOD_KEYS }, description: "Default thisMonth. UTC calendar days; a running period ends today." },
  { name: "from", in: "query", schema: { type: "string", format: "date" }, description: "With period=custom (YYYY-MM-DD, inclusive)." },
  { name: "to", in: "query", schema: { type: "string", format: "date" }, description: "With period=custom (YYYY-MM-DD, inclusive). At most two years." },
  { name: "compare", in: "query", schema: { type: "string", enum: ["previous", "none"] }, description: "previous (default): the span of the same length immediately before." },
  { name: "source", in: "query", schema: { type: "string", enum: Object.keys(SOURCE_FILTERS) } },
  { name: "campaign", in: "query", schema: { type: "string" }, description: "A campaign id or name (case-insensitive)." },
];

export function buildOpenApi({ baseUrl = "https://app.fieldquo.com" } = {}) {
  const metricSchema = {
    type: "object",
    properties: Object.fromEntries(
      METRIC_KEYS.map((k) => [
        k,
        {
          type: "object",
          description: DEFINITIONS[k].en,
          properties: {
            value: { type: ["number", "null"] },
            previous: { type: ["number", "null"] },
            change: { type: ["object", "null"], description: "{ direction: up|down|flat, deltaAbs, deltaPct|null }" },
            reason: { type: ["string", "null"], description: "Why value is null: spend_not_connected, money_not_shared, not_counted_for_this_filter, nothing_to_divide." },
            kind: { type: "string", enum: ["money", "count", "rate", "multiple", "days", "minutes"] },
            definition: { type: "string" },
          },
        },
      ]),
    ),
  };
  return {
    openapi: "3.1.0",
    info: {
      title: "FieldQuo Marketing API",
      version: "1.0.0",
      description:
        "Read a FieldQuo company's marketing results — leads, appointments, closes and revenue against ad spend — with the agency key the company created in Settings › Marketing agency access. The key alone decides the company. No endpoint returns a client's contact details unless the company switched on \"Share contact details with my marketing agency\", and no endpoint sends any message to a client.",
    },
    servers: [{ url: `${baseUrl}/api/v1` }],
    security: [{ agencyKey: [] }],
    components: {
      securitySchemes: {
        agencyKey: { type: "http", scheme: "bearer", description: `Authorization: Bearer fqa_… — permissions: ${SCOPE_READ} (every key), ${SCOPE_WRITE_LEADS} (opt-in).` },
      },
      schemas: {
        Lead: leadSchema(),
        Metrics: metricSchema,
        Refusal: refusal,
        Event: {
          type: "object",
          description: "A REST-hook delivery body, and each item a sample endpoint returns.",
          properties: {
            id: { type: "string" },
            event: { type: "string", enum: EVENTS },
            occurredAt: { type: "string", format: "date-time" },
            data: { type: "object", description: "The event's own facts (fromStage/toStage, outcome, appointmentAt, amount…). Money is null unless job values are shared." },
            lead: { $ref: "#/components/schemas/Lead" },
          },
        },
      },
    },
    "x-events": EVENTS.map((e) => ({ event: e, description: EVENT_DESCRIPTIONS[e] })),
    "x-contact-fields": CONTACT_KEYS,
    "x-money-fields": MONEY_KEYS,
    paths: {
      "/me": { get: { summary: "The key's company, name, permissions and sharing switches (connection test).", responses: { 200: json({ type: "object" }), ...errors } } },
      "/marketing/metrics": { get: { summary: "The dashboard's figures for a period, with the previous equal period, by source and by campaign.", parameters: periodParams, responses: { 200: json({ type: "object", properties: { metrics: { $ref: "#/components/schemas/Metrics" } } }), 400: json(refusal, "A bad period or filter."), ...errors } } },
      "/marketing/funnel": { get: { summary: "Messages from ads → leads → qualified → appointments → quotes sent → closes, with closes without a visit beside it.", parameters: periodParams, responses: { 200: json({ type: "object" }), 400: json(refusal, "A bad period or filter."), ...errors } } },
      "/marketing/leads": {
        get: {
          summary: "Lead rows, oldest change first, paginated by cursor.",
          parameters: [
            { name: "updatedSince", in: "query", schema: { type: "string", format: "date-time" } },
            { name: "cursor", in: "query", schema: { type: "string" }, description: "nextCursor from the previous page." },
            { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } },
            { name: "order", in: "query", schema: { type: "string", enum: ["oldest", "newest"] } },
          ],
          responses: { 200: json({ type: "object", properties: { leads: { type: "array", items: { $ref: "#/components/schemas/Lead" } }, nextCursor: { type: ["string", "null"] } } }), ...errors },
        },
        post: {
          summary: `Add a lead from the agency's own funnel (${SCOPE_WRITE_LEADS}). Deduplicated: the same email or phone within 180 days returns the existing lead with duplicate: true.`,
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: Object.fromEntries(
                    ["name", "firstName", "lastName", "email", "phone", "service", "message", "postalCode", "address", "utmSource", "utmMedium", "utmCampaign", "utmContent", "utmTerm", "campaignId", "campaignName", "adsetId", "adsetName", "adId", "adName", "fbclid", "gclid", "requestedVisitFrom", "requestedVisitTo"].map((k) => [k, { type: "string" }]),
                  ),
                  description: "A name and an email or a phone are required.",
                },
              },
            },
          },
          responses: { 201: json({ type: "object" }, "Created."), 200: json({ type: "object" }, "A duplicate — the existing lead."), 400: json(refusal), ...errors },
        },
      },
      "/marketing/leads/search": { get: { summary: `Find leads by full email or phone (${SCOPE_WRITE_LEADS}). Answers privacy-safe rows.`, parameters: [{ name: "email", in: "query", schema: { type: "string" } }, { name: "phone", in: "query", schema: { type: "string" } }], responses: { 200: json({ type: "object" }), 400: json(refusal), ...errors } } },
      "/marketing/leads/{ref}": { get: { summary: "One lead by its reference (lr_…) or an unambiguous L-XXXX.", parameters: [{ name: "ref", in: "path", required: true, schema: { type: "string" } }], responses: { 200: json({ type: "object", properties: { lead: { $ref: "#/components/schemas/Lead" } } }), 404: json(refusal), 409: json(refusal, "L-XXXX matches more than one lead."), ...errors } } },
      "/marketing/leads/{ref}/stage": { post: { summary: `Move a lead on the pipeline (${SCOPE_WRITE_LEADS}) — only the pipeline's own transitions: won needs an accepted quote or work; lost needs lostReason.`, parameters: [{ name: "ref", in: "path", required: true, schema: { type: "string" } }], requestBody: { content: { "application/json": { schema: { type: "object", properties: { stage: { type: "string", enum: ["new", "contacted", "won", "converted", "lost"] }, lostReason: { type: "string", enum: LOST_REASONS } }, required: ["stage"] } } } }, responses: { 200: json({ type: "object" }), 409: json(refusal, "The pipeline refuses this move."), 404: json(refusal), ...errors } } },
      "/marketing/leads/{ref}/requested-visit": { post: { summary: `Set the visit window asked for (${SCOPE_WRITE_LEADS}). Never changes a booked visit (409 once one is booked).`, parameters: [{ name: "ref", in: "path", required: true, schema: { type: "string" } }], requestBody: { content: { "application/json": { schema: { type: "object", properties: { from: { type: "string", format: "date-time" }, to: { type: "string", format: "date-time" } }, required: ["from", "to"] } } } }, responses: { 200: json({ type: "object" }), 409: json(refusal), 400: json(refusal), ...errors } } },
      "/hooks/subscribe": { post: { summary: "Subscribe a target URL (public https) to an event. Deliveries start with what happens after this call — no history is replayed.", requestBody: { content: { "application/json": { schema: { type: "object", properties: { event: { type: "string", enum: EVENTS }, targetUrl: { type: "string", format: "uri" } }, required: ["event", "targetUrl"] } } } }, responses: { 201: json({ type: "object", properties: { id: { type: "string" } } }), 400: json(refusal), ...errors } } },
      "/hooks/{id}": { delete: { summary: "Unsubscribe. A 410 from your target unsubscribes too.", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: json({ type: "object" }), 404: json(refusal), ...errors } } },
      "/hooks/samples/{event}": { get: { summary: "Recent real payloads of an event (Zapier's perform-list).", parameters: [{ name: "event", in: "path", required: true, schema: { type: "string", enum: EVENTS } }, { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 10 } }], responses: { 200: json({ type: "array", items: { $ref: "#/components/schemas/Event" } }), ...errors } } },
    },
  };
}

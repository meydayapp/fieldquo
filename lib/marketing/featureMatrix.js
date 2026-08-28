// lib/marketing/featureMatrix.js
//
// What FieldQuo tells a stranger it does — and, beside every sentence, the file
// that makes the sentence true.
//
// ══ Why a marketing page needs a check script ══════════════════════════════
//
// AGENTS.md's first rule is "never ship a control that appears to work and
// doesn't". On /app that costs a click. On /pricing it costs a customer: a row
// in a comparison table is what somebody hands their card over for, and
// "you said you had this" is a refund and a support thread, not a bug report.
// A feature named on a public page is the most expensive dead control in the
// product.
//
// So this is not copy. It is a list of CLAIMS, each carrying the route, page or
// library that implements it, and `npm run check:feature-matrix` fails the
// build when a proof path stops existing or stops containing what the claim
// says it contains. Delete a route and the sentence about it goes red, instead
// of quietly becoming a lie that reads as verified because it is on a page.
//
// The precedent is lib/features/registry.js, which makes the same argument one
// layer down: a feature key with no consumer fails check:features. The two
// files are wired together on purpose — every withholdable feature there must
// be claimed or visibly excluded here, so neither list can grow past the other
// unnoticed.
//
// ══ What is NOT in here, and why that is the important part ════════════════
//
// The entries below are the ones with an implementation. Several obvious,
// competitor-listed, "surely we have that" features are absent because the code
// is not there, or is there and is not wired up:
//
//   * A MOBILE APP. There is none. The /app pages are responsive and work in a
//     phone browser; that is a different sentence and it is the only one that
//     may be said. See MATRIX_EXCLUSIONS.
//   * A DEMO. There is none to offer a visitor. app/api/demo/* is FieldQuo's
//     own sales calendar and the seeded sandbox tenants its staff show on a
//     call — not a product a contractor buys, and not a self-serve thing a
//     visitor can start.
//   * Custom fields, and the "Active" flag on email templates. Both have full
//     back-office screens and neither is read at the point it claims to act.
//     They are excluded until they work, and the exclusion says so.
//
// The rule for adding an entry is the registry's rule, in the same order:
// build the thing, then name it. Naming it first is what this file exists to
// prevent.
//
// ══ Written for a painter, not for us ══════════════════════════════════════
//
// `name` is what a cabinet maker would call it out loud — "AI quote review",
// "AI receptionist", "Get paid by card". Internal vocabulary (tenant, webhook,
// cron, template kind) is banned by the check script. `summary` is one
// sentence, in the same register. Everything an engineer needs lives in
// `proof`, where a customer never sees it.

/**
 * The four things a contractor is trying to do, in the order they do them.
 *
 * Not "Quotes / Scheduling / Team / Analytics" — that is a list of our screens,
 * and a painter comparing three products is not shopping for screens. The
 * pipeline in AGENTS.md is the grouping: win it, do it, get paid for it, and
 * run the business that does all three. A feature that does not fit one of
 * those four is either mis-named or does not belong on a pricing page.
 */
export const MATRIX_GROUPS = Object.freeze([
  Object.freeze({
    key: "winning_work",
    label: "Winning the work",
    blurb:
      "Everything between a stranger hearing your name and a signed price: " +
      "where the enquiry comes from, what you send back, and how fast.",
  }),
  Object.freeze({
    key: "doing_the_job",
    label: "Doing the job",
    blurb:
      "Getting the right person to the right address with the right " +
      "information, and knowing what the job actually cost you.",
  }),
  Object.freeze({
    key: "getting_paid",
    label: "Getting paid",
    blurb:
      "Invoicing that mirrors your quote, payment the client can make from " +
      "their phone, and the money landing in your account.",
  }),
  Object.freeze({
    key: "running_the_business",
    label: "Running the business",
    blurb:
      "Your numbers, your people, your prices, and your name on every " +
      "document the homeowner sees.",
  }),
]);

export const GROUP_KEYS = Object.freeze(MATRIX_GROUPS.map((g) => g.key));

/**
 * Whether a feature depends on which plan you are on.
 *
 * There are two values and today every entry uses the first one. That is a
 * finding, not a shortcut — see PLAN_DIFFERENCES. `varies_by_plan` exists so
 * the day a tier genuinely gates something, the table can say so honestly
 * rather than being rewritten in a hurry.
 */
export const AVAILABILITY = Object.freeze(["every_plan", "varies_by_plan"]);

/**
 * Shipped, or shipped in part.
 *
 * "partial" is the useful one. A competitor's table lists subcontractor
 * management; we have a real, narrow piece of it. Answering "yes" oversells and
 * answering "no" undersells something a general contractor would switch for.
 * A partial entry must carry `limits` saying exactly where the edge is — the
 * check script refuses one that doesn't, because a hedge with no detail is a
 * yes wearing a hat.
 */
export const READINESS = Object.freeze(["shipped", "partial"]);

/**
 * Fields on an entry:
 *
 *   key          stable id, snake_case. The renderer's React key and the id a
 *                translation string would hang off.
 *   name         what a contractor calls it. Short enough to be a table row.
 *   summary      one sentence, same register.
 *   group        one of GROUP_KEYS.
 *   availability every_plan | varies_by_plan.
 *   readiness    shipped | partial.
 *   limits       required when partial, forbidden when shipped. The honest
 *                edge, in customer words.
 *   featureKey   the lib/features/registry.js key when FieldQuo can withhold
 *                this from a company, else null. Carried so the renderer can
 *                mark it and so the check can prove the gate is really mounted.
 *   proof        the files that implement it. `holds` is a list of literal
 *                substrings that must appear in the file with comments
 *                stripped — the point being that "the file exists" is a much
 *                weaker statement than "the file still does the thing".
 */
const ENTRIES = [
  // ── Winning the work ─────────────────────────────────────────────────────
  {
    key: "leads",
    name: "Lead tracking",
    summary:
      "Every enquiry in one list, scored hot to cold, with a one-click turn into a quote.",
    group: "winning_work",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/leads/route.js", holds: ["export async function GET"] },
      { path: "app/api/leads/[id]/convert/route.js", holds: ["export async function POST"] },
      { path: "lib/leads/score.js", holds: ["export function scoreLead"] },
      { path: "app/app/leads/page.js", holds: [] },
    ],
  },
  {
    key: "lead_form",
    name: "Lead form for your website",
    summary:
      "A form you can drop on any site; what comes back lands in your leads list, not an inbox.",
    group: "winning_work",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/leads/public/route.js", holds: ["export async function POST"] },
      { path: "lib/leads/createLead.js", holds: ["scoreLead"] },
      { path: "app/app/settings/lead-form/page.js", holds: [] },
    ],
  },
  {
    key: "quotes",
    name: "Quotes",
    summary:
      "Build a quote from your own rates, group it by room or scope, and add photos.",
    group: "winning_work",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/quotes/route.js", holds: ["export async function POST"] },
      { path: "app/components/quotes/builder/QuoteBuilder.js", holds: [] },
      { path: "app/app/quotes/new/page.js", holds: [] },
    ],
  },
  {
    key: "priced_options",
    name: "Good, better, best options",
    summary:
      "Send one job at three prices and let the client pick the one they want.",
    group: "winning_work",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/quotes/tier-group/route.js", holds: ["export async function POST"] },
      { path: "app/api/quotes/tier-group/[tier-group]/route.js", holds: [] },
    ],
  },
  {
    key: "quote_send",
    name: "Send a quote by email",
    summary:
      "One button emails the quote from your address, with the PDF attached, in the client's language.",
    group: "winning_work",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      {
        path: "app/api/quotes/[id]/send/route.js",
        holds: ["export async function POST", "buildQuoteEmail", "sendEmail"],
      },
      { path: "lib/email/quoteEmail.js", holds: [] },
      { path: "lib/i18n/clientLanguage.js", holds: [] },
    ],
  },
  {
    key: "quote_pdf",
    name: "Quote PDF in your colours",
    summary:
      "A PDF that carries your logo and brand colour — nothing on it says FieldQuo.",
    group: "winning_work",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/quotes/[id]/pdf/route.js", holds: ["export async function POST"] },
      { path: "lib/documents/theme.js", holds: ["export function fillPair"] },
    ],
  },
  {
    key: "online_approval",
    name: "Client approves and signs online",
    summary:
      "The client opens a link, picks any extras, signs, and the job is on — no printing, no phone tag.",
    group: "winning_work",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      {
        path: "app/api/public/quotes/[token]/route.js",
        holds: ["export async function POST", "addOnIds", "buildSignatureRecord"],
      },
      { path: "app/q/[token]/QuoteApproval.js", holds: [] },
      { path: "lib/documents/signatureAudit.js", holds: [] },
    ],
  },
  {
    key: "ai_quote_review",
    name: "AI quote review",
    summary:
      "Before you send it: what you forgot, how the price sits against the ones you have won, and clearer wording.",
    group: "winning_work",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      {
        path: "app/api/quotes/[id]/review/route.js",
        holds: ["export async function POST", "reviewQuote", "checkAiQuota"],
      },
      { path: "lib/ai/quoteReview.js", holds: ["export async function reviewQuote"] },
      { path: "app/app/estimate-reviews/page.js", holds: [] },
    ],
  },
  {
    key: "add_on_upsell",
    name: "Suggested add-ons",
    summary:
      "Optional extras at the bottom of the quote, priced from your own history, that the client can tick.",
    group: "winning_work",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/quotes/[id]/add-ons/route.js", holds: ["export async function PUT"] },
      { path: "app/api/ai/quote-suggestions/route.js", holds: ["export async function POST"] },
      { path: "lib/ai/quoteSuggestions.js", holds: [] },
    ],
  },
  {
    key: "follow_ups",
    name: "Automatic follow-ups",
    summary:
      "A quote that goes quiet gets chased on your schedule, in your words, without you remembering.",
    group: "winning_work",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/settings/follow-up-rules/route.js", holds: ["export async function POST"] },
      { path: "app/api/cron/follow-ups/route.js", holds: ["export async function GET"] },
    ],
  },
  {
    key: "voice_receptionist",
    name: "AI receptionist",
    summary:
      "Answers your phone when you are on a ladder, takes the details, books the visit, and leaves you the recording.",
    group: "winning_work",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: "voice_receptionist",
    proof: [
      {
        path: "app/api/settings/voice/number/route.js",
        holds: ["export async function POST"],
      },
      { path: "app/api/voice/webhook/route.js", holds: ["export async function POST"] },
      { path: "app/api/voice/tools/[tool]/route.js", holds: ["export async function POST"] },
      { path: "lib/voice/retell.js", holds: [] },
      { path: "app/app/receptionist/page.js", holds: [] },
    ],
  },
  {
    key: "voice_callbacks",
    name: "Confirmation calls",
    summary:
      "The assistant rings ahead to confirm tomorrow's appointments so you do not lose the morning to no-shows.",
    group: "winning_work",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: "voice_receptionist",
    proof: [
      { path: "app/api/cron/voice-outbound/route.js", holds: ["export async function GET"] },
      { path: "lib/voice/spendGate.js", holds: [] },
    ],
  },
  {
    key: "call_to_quote",
    name: "Quote drafted from the call",
    summary:
      "What the caller described comes back as a draft quote you open, correct and send.",
    group: "winning_work",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: "voice_receptionist",
    proof: [
      {
        path: "app/api/voice/calls/[id]/draft-quote/route.js",
        holds: ["export async function POST"],
      },
      { path: "app/api/voice/calls/route.js", holds: ["export async function GET"] },
    ],
  },
  {
    key: "booking_page",
    name: "Online booking page",
    summary:
      "Clients pick a slot from your real availability, with travel time and arrival windows built in.",
    group: "winning_work",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      {
        path: "app/api/booking/[companySlug]/confirm/route.js",
        holds: ["export async function POST"],
      },
      { path: "lib/booking/computeAvailability.js", holds: [] },
      { path: "lib/booking/arrivalWindow.js", holds: [] },
      { path: "app/book/[companySlug]/[eventSlug]/page.js", holds: [] },
    ],
  },
  {
    key: "booking_deposit",
    name: "Take a deposit to hold the slot",
    summary:
      "Charge a visit fee at booking and credit it against the invoice when the work goes ahead.",
    group: "winning_work",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "lib/booking/fee.js", holds: [] },
      {
        path: "app/api/booking/[companySlug]/settle/route.js",
        holds: ["export async function POST"],
      },
      {
        path: "app/api/invoices/[id]/credit-visit-fee/route.js",
        holds: ["export async function POST"],
      },
    ],
  },
  {
    key: "website_builder",
    name: "Your own website",
    summary:
      "A site written from what you already told us, on your own address, that you can edit block by block.",
    group: "winning_work",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: "website_builder",
    proof: [
      { path: "app/api/settings/website/route.js", holds: ["export async function PUT"] },
      { path: "lib/site/generateSite.js", holds: ["sanitiseBlocks"] },
      { path: "app/data/siteBlocks.js", holds: ["sanitiseBlocks"] },
      { path: "app/site/[subdomain]/page.js", holds: [] },
    ],
  },
  {
    key: "instant_quotes",
    name: "Instant online estimate",
    summary:
      "A visitor answers a few questions and gets a price range on the spot, from rates you set.",
    group: "winning_work",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: "instant_quotes",
    proof: [
      { path: "app/api/settings/instant-quote/route.js", holds: ["export async function PUT"] },
      {
        path: "app/api/instant-quote/[companySlug]/request/route.js",
        holds: ["export async function POST"],
      },
      { path: "app/instant-quote/[companySlug]/page.js", holds: [] },
    ],
  },
  {
    key: "self_quote",
    name: "Clients can price their own job",
    summary:
      "A public form where a homeowner describes the work and uploads photos; it arrives as a started quote.",
    group: "winning_work",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/self-quote/route.js", holds: ["export async function POST"] },
      { path: "app/api/self-quote/[companySlug]/route.js", holds: ["export async function GET"] },
      { path: "app/quote/[companySlug]/page.js", holds: [] },
    ],
  },
  {
    key: "kitchen_designer",
    name: "Kitchen and cabinet designer",
    summary:
      "Draw the run, pick the finishes, and the cabinet prices and the floor plan go straight into the quote.",
    group: "winning_work",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/kitchen-design/[token]/route.js", holds: ["export async function GET"] },
      { path: "lib/kitchen/rates.js", holds: [] },
      { path: "app/design/[token]/page.js", holds: [] },
      { path: "app/app/quotes/[id]/kitchen/page.js", holds: [] },
    ],
  },
  {
    key: "aerial_measure",
    name: "Measure from the sky",
    summary:
      "Type the address and get roof area and pitch, or trace a driveway or patio, without going out there.",
    group: "winning_work",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/measure/roof/route.js", holds: ["export async function GET", "measureRoof"] },
      { path: "app/api/measure/satellite/route.js", holds: ["export async function GET"] },
      { path: "lib/measure/roofMeasurement.js", holds: [] },
    ],
  },
  {
    key: "funnels",
    name: "Lead funnels",
    summary:
      "Multi-step landing pages for an ad or a flyer, with numbers on where people drop out.",
    group: "winning_work",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: "funnels",
    proof: [
      { path: "app/api/funnels/route.js", holds: ["export async function POST"] },
      { path: "app/api/funnels/[id]/analytics/route.js", holds: ["export async function GET"] },
      { path: "app/f/[companySlug]/[funnelSlug]/page.js", holds: [] },
    ],
  },
  {
    key: "email_campaigns",
    name: "Email campaigns",
    summary:
      "Write once, send to your client list from your own address, and see who it reached.",
    group: "winning_work",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: "marketing_campaigns",
    proof: [
      {
        path: "app/api/marketing/campaigns/[id]/send/route.js",
        holds: ["export async function POST", "sendEmail"],
      },
      { path: "app/api/marketing/subscribers/route.js", holds: ["export async function GET"] },
    ],
  },
  {
    key: "door_hanger_routes",
    name: "Door-hanger routes",
    summary:
      "Plan the streets, assign them, and tick off the stops as your crew works the neighbourhood.",
    group: "winning_work",
    availability: "every_plan",
    readiness: "partial",
    limits:
      "FieldQuo plans and tracks the route. It does not print the door hangers " +
      "or arrange delivery — you supply the printed material.",
    featureKey: "marketing_campaigns",
    proof: [
      {
        path: "app/api/marketing/campaigns/[id]/stops/route.js",
        holds: ["export async function POST"],
      },
      { path: "app/api/marketing/stops/[id]/route.js", holds: ["export async function PATCH"] },
    ],
  },
  {
    key: "review_requests",
    name: "Review requests",
    summary:
      "After the job is done and paid, the client gets one polite ask for a review.",
    group: "winning_work",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/cron/review-requests/route.js", holds: ["export async function GET"] },
      { path: "app/api/settings/reviews/route.js", holds: ["export async function PATCH"] },
    ],
  },
  {
    key: "testimonials",
    name: "Testimonials on your site",
    summary:
      "Collect what clients said and show it on your website and in your quotes.",
    group: "winning_work",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/settings/testimonials/route.js", holds: ["export async function POST"] },
      { path: "app/api/settings/testimonials/import/route.js", holds: ["export async function POST"] },
    ],
  },
  {
    key: "referrals",
    name: "Refer another contractor",
    summary:
      "Send an invite; when they sign up you both get a free month added to your account.",
    group: "winning_work",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/settings/referral/invite/route.js", holds: ["export async function POST"] },
      {
        path: "lib/referrals/extendAccess.js",
        holds: ["export async function extendAccessByMonths"],
      },
      { path: "app/refer/[code]/page.js", holds: [] },
    ],
  },
  {
    key: "embeds",
    name: "Drop-in widgets",
    summary:
      "Paste one line into any website you already have to embed your booking, quote form or reviews.",
    group: "winning_work",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "lib/embed/snippet.js", holds: [] },
      { path: "app/embed/[companySlug]/[widget]/page.js", holds: [] },
    ],
  },
  {
    key: "bio_link",
    name: "One link for your profiles",
    summary:
      "A single branded page for your Instagram or truck decal that points at everything you offer.",
    group: "winning_work",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/settings/links/route.js", holds: ["export async function PATCH"] },
      { path: "app/l/[slug]/page.js", holds: [] },
    ],
  },
  {
    key: "subcontractor_bids",
    name: "Subcontractor prices in your bid",
    summary:
      "Pull a sub's quote straight into yours as a cost, mark it up, and your client sees only your price.",
    group: "winning_work",
    availability: "every_plan",
    readiness: "partial",
    limits:
      "This works when the subcontractor is also on FieldQuo and sends you " +
      "their quote link. There is no list of the subs you use, no way to put " +
      "one on a job or a visit, no way to pay the company whose price you " +
      "took, and no insurance or tax-form tracking.",
    featureKey: null,
    proof: [
      {
        path: "app/api/quotes/received/[token]/import/route.js",
        holds: ["export async function POST"],
      },
      { path: "lib/quotes/importQuote.js", holds: ["ensureSubcontractorCategory"] },
      { path: "app/q/[token]/ContractorImportPanel.js", holds: [] },
      { path: "app/app/quotes/[id]/ImportedCostsPanel.js", holds: [] },
    ],
  },

  // ── Doing the job ────────────────────────────────────────────────────────
  {
    key: "jobs",
    name: "Jobs",
    summary:
      "An approved quote becomes a job with the scope, the address and the paperwork already on it.",
    group: "doing_the_job",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/jobs/route.js", holds: ["export async function POST"] },
      { path: "app/app/jobs/[id]/page.js", holds: [] },
    ],
  },
  {
    key: "scheduling",
    name: "Scheduling and dispatch",
    summary:
      "Put visits on the calendar, assign the person going, and see the whole crew's week at once.",
    group: "doing_the_job",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/jobs/[id]/visits/route.js", holds: ["export async function POST"] },
      { path: "app/api/schedule/team/route.js", holds: ["export async function GET"] },
      { path: "app/app/scheduler/page.js", holds: [] },
    ],
  },
  {
    key: "crew_shifts",
    name: "Crew shifts",
    summary:
      "Build next week's rota, publish it, and everyone sees their own shifts.",
    group: "doing_the_job",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/shifts/route.js", holds: ["export async function POST"] },
      { path: "app/api/shifts/publish/route.js", holds: ["export async function POST"] },
      { path: "app/app/schedule/page.js", holds: [] },
    ],
  },
  {
    key: "recurring_jobs",
    name: "Repeat jobs",
    summary:
      "Weekly, monthly or seasonal work that puts itself back on the calendar.",
    group: "doing_the_job",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/cron/recurring-jobs/route.js", holds: ["export async function GET"] },
    ],
  },
  {
    key: "appointment_reminders",
    name: "Appointment reminders",
    summary:
      "The client gets a text before you arrive, so fewer doors are locked when you get there.",
    group: "doing_the_job",
    availability: "every_plan",
    readiness: "partial",
    limits:
      "Reminders go by text message only. There is no email reminder, and the " +
      "reminder wording is not editable yet — the on-my-way message is.",
    featureKey: null,
    proof: [
      {
        path: "app/api/cron/appointment-reminders/route.js",
        holds: ["export async function GET", "sendSms"],
      },
      { path: "lib/sms/twilioClient.js", holds: [] },
      { path: "app/api/settings/appointment-reminders/route.js", holds: [] },
    ],
  },
  {
    key: "client_reschedule",
    name: "Clients reschedule themselves",
    summary:
      "A link in the confirmation lets the client move the visit without ringing you.",
    group: "doing_the_job",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/visit/[token]/reschedule/route.js", holds: ["export async function POST"] },
      { path: "app/visit/[token]/page.js", holds: [] },
    ],
  },
  {
    key: "job_costing",
    name: "Job costing",
    summary:
      "Labour, materials and expenses against the price you quoted, so you know what you actually made.",
    group: "doing_the_job",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/jobs/[id]/costing/route.js", holds: ["export async function GET"] },
      { path: "app/api/quotes/[id]/costing/route.js", holds: ["export async function GET"] },
    ],
  },
  {
    key: "materials",
    name: "Materials on the job",
    summary:
      "What went on site, what it cost, and what is still to buy.",
    group: "doing_the_job",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/jobs/[id]/materials/route.js", holds: ["export async function POST"] },
    ],
  },
  {
    key: "job_photos",
    name: "Before and after photos",
    summary:
      "Photos filed against the job, ready to go into the quote, the invoice or your website.",
    group: "doing_the_job",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/jobs/[id]/photos/route.js", holds: ["export async function GET"] },
      { path: "app/api/upload/route.js", holds: ["export async function POST"] },
    ],
  },
  {
    key: "checklists",
    name: "Job checklists",
    summary:
      "A list of what has to be done on site, ticked off by the person doing it.",
    group: "doing_the_job",
    availability: "every_plan",
    readiness: "partial",
    limits:
      "Checklist templates are pulled in when you create a visit from the " +
      "visit screen. A visit created any other way starts with an empty list.",
    featureKey: null,
    proof: [
      { path: "app/api/settings/checklists/route.js", holds: ["export async function POST"] },
      { path: "app/app/jobs/[id]/visits/new/page.js", holds: ["/api/settings/checklists"] },
    ],
  },
  {
    key: "suggested_tasks",
    name: "Suggested next steps",
    summary:
      "The job proposes the tasks a job like this usually needs, so nothing gets forgotten.",
    group: "doing_the_job",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/jobs/[id]/suggested-tasks/route.js", holds: ["export async function POST"] },
    ],
  },
  {
    key: "tasks",
    name: "To-do list",
    summary:
      "Everything that needs chasing, sorted by what will hurt most if you leave it.",
    group: "doing_the_job",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/tasks/route.js", holds: ["export async function POST"] },
      { path: "lib/tasks/autoCreate.js", holds: [] },
      { path: "app/app/tasks/page.js", holds: [] },
    ],
  },
  {
    key: "work_areas",
    name: "Work areas",
    summary:
      "Break a big job into rooms or zones and hand each one to a different person.",
    group: "doing_the_job",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/work-areas/route.js", holds: ["export async function POST"] },
    ],
  },
  {
    key: "time_clock",
    name: "Clock in and out",
    summary:
      "Crew clock on against the job they are on, from whatever phone they have.",
    group: "doing_the_job",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/time-clock/route.js", holds: ["export async function POST"] },
      { path: "app/app/clock/page.js", holds: [] },
    ],
  },
  {
    key: "timesheets",
    name: "Timesheets you approve",
    summary:
      "Hours land tied to real jobs; you approve them before they can turn into pay.",
    group: "doing_the_job",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/time-entries/[id]/route.js", holds: ["export async function PATCH"] },
      { path: "app/app/settings/team/timesheets/page.js", holds: [] },
    ],
  },
  {
    key: "crew_inbox",
    name: "Crew inbox",
    summary:
      "Your crew text photos and updates to one number and they file themselves against the right job.",
    group: "doing_the_job",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: "crew_inbox",
    proof: [
      { path: "app/api/crew/inbound/route.js", holds: ["export async function POST"] },
      { path: "app/api/crew/line/route.js", holds: ["export async function POST"] },
      { path: "lib/crew/inboundParse.js", holds: [] },
      { path: "app/app/crew-inbox/page.js", holds: [] },
    ],
  },
  {
    key: "time_off",
    name: "Time off and holidays",
    summary:
      "Requests go to the right manager, balances build up on their own, and the calendar knows.",
    group: "doing_the_job",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/leave/route.js", holds: ["export async function POST"] },
      { path: "lib/leave/accrual.js", holds: [] },
      { path: "app/app/time-off/page.js", holds: [] },
    ],
  },

  // ── Getting paid ─────────────────────────────────────────────────────────
  {
    key: "invoices",
    name: "Invoices",
    summary:
      "An approved quote turns into an invoice that looks like the quote, because it is built from it.",
    group: "getting_paid",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/invoices/route.js", holds: ["export async function POST"] },
      { path: "lib/invoices/createInvoiceFromQuote.js", holds: [] },
      { path: "lib/invoices/invoiceNumber.js", holds: [] },
    ],
  },
  {
    key: "invoice_send",
    name: "Send an invoice",
    summary:
      "Emailed from your address with the PDF attached and a pay-now link inside.",
    group: "getting_paid",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      {
        path: "app/api/invoices/[id]/send/route.js",
        holds: ["export async function POST", "buildInvoiceEmail", "sendEmail"],
      },
      { path: "app/api/invoices/[id]/pdf/route.js", holds: ["export async function POST"] },
    ],
  },
  {
    key: "invoice_changes",
    name: "Changed invoices, tracked",
    summary:
      "Amend an issued invoice and the old one is kept, so there is never a question about what was agreed.",
    group: "getting_paid",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/invoices/[id]/lifecycle/route.js", holds: ["export async function GET"] },
      { path: "app/api/invoices/[id]/route.js", holds: ["export async function PATCH"] },
    ],
  },
  {
    key: "card_payments",
    name: "Get paid by card",
    summary:
      "The client pays from their phone and the money goes to your account, not ours.",
    group: "getting_paid",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      {
        path: "app/api/invoices/[id]/checkout-link/route.js",
        holds: ["export async function POST", "createInvoiceCheckoutSession"],
      },
      { path: "lib/stripe.js", holds: ["transfer_data"] },
      { path: "app/api/portal/[token]/pay/route.js", holds: ["export async function POST"] },
    ],
  },
  {
    key: "stripe_connect",
    name: "Your own payout account",
    summary:
      "Connect your bank once; every client payment settles into it directly.",
    group: "getting_paid",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      {
        path: "app/api/stripe/connect/route.js",
        holds: ["export async function POST", "createConnectOnboardingLink"],
      },
      { path: "app/api/stripe/connect/status/route.js", holds: ["export async function GET"] },
    ],
  },
  {
    key: "financing",
    name: "Let clients pay monthly",
    summary:
      "Turn on pay-over-time at checkout for the big jobs homeowners put off.",
    group: "getting_paid",
    availability: "every_plan",
    readiness: "partial",
    limits:
      "Pay-over-time is offered at checkout through Stripe, where the lender " +
      "decides. FieldQuo does not lend and does not approve anyone. The " +
      "monthly figure shown on a quote appears only if you enter your own rate " +
      "and term — we never invent one.",
    featureKey: null,
    proof: [
      { path: "lib/stripe.js", holds: ["affirm"] },
      { path: "lib/financing/monthlyEstimate.js", holds: [] },
      { path: "app/app/settings/payments/page.js", holds: ["offerFinancing"] },
    ],
  },
  {
    key: "service_plans",
    name: "Maintenance plans",
    summary:
      "Sign a client up to a recurring plan and the card is charged on schedule without you asking.",
    group: "getting_paid",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/service-plans/route.js", holds: ["export async function POST"] },
      { path: "app/api/service-plans/[id]/authorise/route.js", holds: ["export async function POST"] },
      { path: "lib/servicePlans/stripeMandate.js", holds: [] },
      { path: "app/api/cron/service-plans/route.js", holds: ["export async function GET"] },
    ],
  },
  {
    key: "client_portal",
    name: "Client portal",
    summary:
      "One link where a client sees their quotes, invoices and what they still owe.",
    group: "getting_paid",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/portal/[token]/route.js", holds: ["export async function GET"] },
      { path: "app/portal/[token]/page.js", holds: [] },
    ],
  },
  {
    key: "sales_tax",
    name: "Sales tax that matches the address",
    summary:
      "Set your rates once; the right one lands on the document for where the work is.",
    group: "getting_paid",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/settings/tax-rate/route.js", holds: ["export async function POST"] },
      { path: "lib/tax/jurisdictions.js", holds: [] },
      { path: "lib/tax/documentTax.js", holds: [] },
    ],
  },

  // ── Running the business ─────────────────────────────────────────────────
  {
    key: "dashboard",
    name: "Dashboard",
    summary:
      "What is quoted, won, scheduled and owed, on one screen, as of this morning.",
    group: "running_the_business",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/analytics/overview/route.js", holds: ["export async function GET"] },
      { path: "lib/analytics/overview.js", holds: [] },
      { path: "app/app/page.js", holds: [] },
    ],
  },
  {
    key: "break_even",
    name: "Your break-even price",
    summary:
      "What a day has to bring in before you make a cent, worked out from your real overhead.",
    group: "running_the_business",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/analytics/burn-rate/route.js", holds: ["export async function GET"] },
      { path: "app/api/analytics/minimum-price/route.js", holds: ["export async function GET"] },
      { path: "lib/analytics/minimumPrice.js", holds: [] },
    ],
  },
  {
    key: "benchmark",
    name: "How your prices compare",
    summary:
      "Where your rates and your win rate sit against other shops in your trade — nobody named, including you.",
    group: "running_the_business",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/analytics/pricing-benchmark/route.js", holds: ["export async function GET"] },
      { path: "lib/analytics/pricingBenchmark.js", holds: [] },
      { path: "app/app/analytics/benchmark/page.js", holds: [] },
    ],
  },
  {
    key: "monthly_digest",
    name: "Monthly write-up",
    summary:
      "Once a month, your numbers explained in sentences instead of charts.",
    group: "running_the_business",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/cron/monthly-digest/route.js", holds: ["export async function GET"] },
      { path: "lib/ai/monthlyDigest.js", holds: [] },
      { path: "app/app/analytics/digest/page.js", holds: [] },
    ],
  },
  {
    key: "goals",
    name: "Revenue goal",
    summary:
      "Set a target for the year and see how far ahead or behind you are.",
    group: "running_the_business",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/analytics/goal/route.js", holds: ["export async function PUT"] },
    ],
  },
  {
    key: "expenses",
    name: "Expenses and overhead",
    summary:
      "Record what you spend, split what belongs to a job from what belongs to the business.",
    group: "running_the_business",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/expenses/route.js", holds: ["export async function POST"] },
      { path: "app/api/overhead/fixed-costs/route.js", holds: ["export async function POST"] },
      { path: "app/api/debt/route.js", holds: ["export async function POST"] },
    ],
  },
  {
    key: "marketing_spend",
    name: "What your advertising is worth",
    summary:
      "Spend by channel against the jobs it actually brought in, so you can stop paying for the ones that don't.",
    group: "running_the_business",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/marketing-spend/route.js", holds: ["export async function POST"] },
      { path: "lib/analytics/marketingRollup.js", holds: [] },
    ],
  },
  {
    key: "payroll",
    name: "Payroll",
    summary:
      "Approved hours become a pay run with payslips you can hand over or export for your accountant.",
    group: "running_the_business",
    availability: "every_plan",
    readiness: "partial",
    limits:
      "FieldQuo works out gross pay, produces the payslips and exports the run. " +
      "It does not pay employees or file your payroll taxes — deductions are " +
      "the ones you or your accountant supply.",
    featureKey: null,
    proof: [
      { path: "app/api/payroll/runs/route.js", holds: ["export async function POST"] },
      { path: "lib/payroll/computePayRun.js", holds: [] },
      { path: "lib/payroll/renderPayslipPdf.js", holds: [] },
      { path: "app/api/payroll/runs/[id]/export/route.js", holds: ["export async function GET"] },
    ],
  },
  {
    key: "contractor_payouts",
    name: "Pay contractors from the app",
    summary:
      "Approved hours for someone on your roster marked as a contractor go out as a real transfer to their bank.",
    group: "running_the_business",
    availability: "every_plan",
    readiness: "partial",
    limits:
      "This pays a person on your own roster, for hours they clocked, at the " +
      "rate you set. It cannot pay a fixed bid to another company. Transfers " +
      "are sent in Canadian dollars today, so it is not ready for a US payout.",
    featureKey: null,
    proof: [
      {
        path: "app/api/payouts/route.js",
        holds: ["export async function POST", "runContractorPayoutsForCompany"],
      },
      { path: "lib/payroll/stripeConnectPayout.js", holds: ["payoutToContractor"] },
      { path: "app/api/workers/[id]/connect/route.js", holds: ["export async function POST"] },
    ],
  },
  {
    key: "price_book",
    name: "Your price book",
    summary:
      "Your services and rates in one place, importable from a spreadsheet and exportable back out.",
    group: "running_the_business",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/products/route.js", holds: ["export async function POST"] },
      { path: "app/api/products/import/route.js", holds: ["export async function POST"] },
      { path: "app/api/settings/service-categories/route.js", holds: ["export async function POST"] },
    ],
  },
  {
    key: "material_costs",
    name: "Material costs and recipes",
    summary:
      "What a litre of paint or a sheet of ply costs you, and how much of it a job of this size eats.",
    group: "running_the_business",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/settings/material-recipes/route.js", holds: ["export async function PUT"] },
      { path: "app/api/settings/cabinet-rates/route.js", holds: ["export async function PUT"] },
    ],
  },
  {
    key: "team_access",
    name: "Team roles and access",
    summary:
      "Decide, dial by dial, what each person can see and change — and it holds on the server, not just on screen.",
    group: "running_the_business",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/settings/members/route.js", holds: ["export async function POST"] },
      { path: "lib/permissions/enforce.js", holds: [] },
      { path: "app/components/team/AccessEditor.js", holds: [] },
    ],
  },
  {
    key: "white_label",
    name: "Everything carries your name",
    summary:
      "Your logo and your colour on every quote, invoice, page and email a homeowner sees.",
    group: "running_the_business",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/settings/business-info/route.js", holds: ["export async function PATCH"] },
      { path: "lib/documents/theme.js", holds: ["export function neutralPair"] },
      { path: "lib/brand/colour.js", holds: [] },
    ],
  },
  {
    key: "own_email_domain",
    name: "Email from your own address",
    summary:
      "Verify your domain once and everything goes out from you, not from a shared address.",
    group: "running_the_business",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/settings/email-domain/route.js", holds: ["export async function POST"] },
      { path: "lib/email/resendDomains.js", holds: [] },
    ],
  },
  {
    key: "quote_email_wording",
    name: "Write your own covering email",
    summary:
      "Change what the quote email says, section by section, and it stays in the language the quote was written in.",
    group: "running_the_business",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/settings/quote-email/route.js", holds: ["export async function PATCH"] },
      { path: "app/api/quotes/[id]/email-sections/route.js", holds: ["export async function GET"] },
    ],
  },
  {
    key: "document_layouts",
    name: "Your own quote and invoice layout",
    summary:
      "Choose which sections appear on the printed document, and which one is the default.",
    group: "running_the_business",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/settings/document-templates/route.js", holds: ["export async function POST"] },
      {
        path: "app/api/settings/document-templates/[id]/activate/route.js",
        holds: ["export async function POST"],
      },
    ],
  },
  {
    key: "contract_terms",
    name: "Your terms on every document",
    summary:
      "Payment terms and contract wording that attach themselves to what you send.",
    group: "running_the_business",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/templates/route.js", holds: ["export async function POST"] },
      { path: "lib/documents/contractTerms.js", holds: [] },
    ],
  },
  {
    key: "languages",
    name: "English and French",
    summary:
      "Send a quote in the language your client speaks; a signed document keeps the words it was signed with.",
    group: "running_the_business",
    availability: "every_plan",
    readiness: "partial",
    limits:
      "English and French are finished. Spanish, Ukrainian, Punjabi and " +
      "Tagalog are translated and still being checked by a speaker, so they " +
      "are not switched on yet.",
    featureKey: null,
    proof: [
      { path: "app/api/settings/language/route.js", holds: ["export async function PATCH"] },
      { path: "app/api/settings/translations/route.js", holds: ["export async function PATCH"] },
      { path: "lib/i18n/clientLanguage.js", holds: [] },
    ],
  },
  {
    key: "ai_copilot",
    name: "Ask FieldQuo AI",
    summary:
      "Ask a question about your own business in plain English and get the answer from your own numbers.",
    group: "running_the_business",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: "ai_copilot",
    proof: [
      { path: "app/api/ai/copilot/route.js", holds: ["export async function POST", "checkAiQuota"] },
      { path: "lib/ai/copilotTools.js", holds: [] },
      { path: "app/app/copilot/page.js", holds: [] },
    ],
  },
  {
    key: "activity_log",
    name: "Who changed what",
    summary:
      "A running record of every send, edit and approval, with a name and a time against it.",
    group: "running_the_business",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/activity/route.js", holds: ["export async function GET"] },
      { path: "lib/activity/log.js", holds: [] },
      { path: "app/app/activity/page.js", holds: [] },
    ],
  },
  {
    key: "clients",
    name: "Client list",
    summary:
      "Every client, their properties and their history, imported from wherever it lives now.",
    group: "running_the_business",
    availability: "every_plan",
    readiness: "shipped",
    limits: null,
    featureKey: null,
    proof: [
      { path: "app/api/clients/route.js", holds: ["export async function POST"] },
      { path: "app/api/clients/import/route.js", holds: ["export async function POST"] },
    ],
  },
];

/** Frozen: the renderer reads this list and may not add to it. */
export const FEATURE_MATRIX = Object.freeze(
  ENTRIES.map((e) =>
    Object.freeze({
      ...e,
      proof: Object.freeze(
        e.proof.map((p) => Object.freeze({ ...p, holds: Object.freeze([...(p.holds || [])]) })),
      ),
    }),
  ),
);

export const MATRIX_KEYS = Object.freeze(FEATURE_MATRIX.map((e) => e.key));

/**
 * What FieldQuo does NOT claim, and why.
 *
 * This exists so absence is a decision on the record rather than an oversight.
 * The check script requires every withholdable feature in
 * lib/features/registry.js to be either claimed above or named here, so the two
 * lists cannot silently drift; and the entries with no `registryKey` are the
 * ones a marketing page invents by itself because the competition has them.
 */
export const MATRIX_EXCLUSIONS = Object.freeze([
  Object.freeze({
    subject: "A phone application",
    registryKey: null,
    reason:
      "There is no application to install, on any store. The back office is " +
      "responsive and works in a phone browser, and that is the only claim " +
      "that may ever be made about it. Nothing in this file may say otherwise.",
  }),
  Object.freeze({
    subject: "A self-serve trial you can look at before signing up",
    registryKey: null,
    reason:
      "There is nothing a visitor can start and look around. The seeded " +
      "sandbox tenants and the booking routes under app/api/demo belong to " +
      "FieldQuo's own sales calls, are not sold to anybody, and must never be " +
      "described on a public page as something a visitor gets.",
  }),
  Object.freeze({
    subject: "Custom fields on jobs, clients and quotes",
    registryKey: null,
    reason:
      "The settings screen saves field definitions and nothing anywhere reads " +
      "the values, so a required field is never rendered, collected or " +
      "printed. Excluded until something reads it. See " +
      "app/api/custom-fields/route.js.",
  }),
  Object.freeze({
    subject: "Custom email templates chosen by an Active flag",
    registryKey: null,
    reason:
      "Setting a quote or receipt email template Active moves a badge; the " +
      "real send uses lib/email/quoteEmail.js and lib/email/invoiceEmail.js " +
      "and never reads it. The covering-email wording that IS editable is " +
      "claimed above as quote_email_wording.",
  }),
  Object.freeze({
    subject: "One inbox for Google, Thumbtack and Angi leads",
    registryKey: null,
    reason:
      "Not built. It needs a signed-in account with each marketplace before " +
      "any of it can be written or tested, and docs/ROADMAP.md records the " +
      "decision to wait rather than ship an untested integration.",
  }),
  Object.freeze({
    subject: "Importing your Google reviews",
    registryKey: null,
    reason:
      "Researched and blocked on Google's own approval, not on our code. " +
      "Review requests are claimed above; importing what Google already holds " +
      "is not, and must not be implied by the review-request row.",
  }),
  Object.freeze({
    subject: "Transferring a call to a person",
    registryKey: null,
    reason:
      "The receptionist cannot hand a caller over to you mid-call. A column " +
      "for it is saved but no screen offers it and nothing in lib/voice reads " +
      "it, so the receptionist row must not imply a warm transfer.",
  }),
]);

/**
 * What actually differs between the four plans.
 *
 * ══ The finding, stated plainly ════════════════════════════════════════════
 *
 * Nothing in the matrix above is withheld from a cheaper plan. Solo, Crew, Shop
 * and Scale differ in how many people they seat and what they cost, and in
 * nothing else. Every rung gets the receptionist, the website, the AI review,
 * the payouts, all of it.
 *
 * That is an unusual answer for a pricing table and the temptation is to invent
 * a difference, because a comparison grid with a tick in every cell looks
 * broken. Inventing one would be the exact failure this file exists to prevent,
 * one column over: a dash in the Solo column is a promise that Solo does not
 * get something, and there is no code anywhere that makes it true.
 *
 * The honest table therefore has two axes — the features, all included, and the
 * size of the business, which is what you pay for. `check:feature-matrix`
 * asserts this against SEAT_LADDER itself, so the day a rung gains a feature
 * field the claim fails rather than quietly going stale.
 */
export const PLAN_DIFFERENCES = Object.freeze({
  varies: Object.freeze([
    Object.freeze({
      key: "seats",
      label: "How many people can create and change quotes, jobs and invoices",
      proof: Object.freeze([
        { path: "lib/pricing/ladder.js", holds: ["export const SEAT_LADDER", "isBillableSeat"] },
        { path: "lib/pricing/seatLimit.js", holds: ["seatCheck"] },
      ]),
    }),
    Object.freeze({
      key: "crew",
      label: "How many crew can see their schedule, clock in and send photos — free on every plan",
      proof: Object.freeze([
        { path: "lib/pricing/ladder.js", holds: ["crewSeats"] },
        { path: "lib/pricing/seatLimit.js", holds: ["crewSeats"] },
      ]),
    }),
    Object.freeze({
      key: "price",
      label: "What it costs a month, in your own currency, from the address you signed up with",
      proof: Object.freeze([
        { path: "lib/pricing/ladder.js", holds: ["currencyForCountry", "priceFor"] },
      ]),
    }),
    Object.freeze({
      key: "annual",
      label: "Pay for ten months and get twelve, if you commit to the year",
      proof: Object.freeze([
        {
          path: "lib/pricing/ladder.js",
          holds: ["ANNUAL_FREE_MONTHS", "annualComparison"],
        },
      ]),
    }),
  ]),

  /**
   * Columns on the Plan row that LOOK like per-tier feature gates.
   *
   * Two of them are real limiters that the four shipped rungs simply leave
   * open. One is not wired to anything at all — and the public pricing page
   * prints a feature line from it, which is why it is written down here rather
   * than left for somebody to rediscover.
   */
  planColumns: Object.freeze([
    Object.freeze({
      column: "Plan.maxUsers",
      note:
        "A real cap, enforced when somebody is invited. The ladder sets it to " +
        "seats plus crew, so it is the headcount limit the plan cards already " +
        "advertise — not a hidden feature gate.",
      enforcedIn: Object.freeze([
        { path: "lib/platform/planLimits.js", holds: ["export async function checkUserLimit"] },
        { path: "app/api/settings/members/route.js", holds: ["checkUserLimit"] },
      ]),
      mentionedIn: null,
    }),
    Object.freeze({
      column: "Plan.maxQuotesPerMonth",
      note:
        "A real cap and genuinely enforced, but every shipped rung leaves it " +
        "empty, so no plan limits how many quotes you write. If an operator " +
        "ever fills it in, the limit bites for real — this is not a dead " +
        "column, it is an unused one.",
      enforcedIn: Object.freeze([
        { path: "lib/platform/planLimits.js", holds: ["export async function checkQuoteLimit"] },
        { path: "app/api/quotes/route.js", holds: ["requireWithinLimit"] },
      ]),
      mentionedIn: null,
    }),
    Object.freeze({
      column: "Plan.aiCopilotEnabled",
      note:
        "Printed on the public pricing card as a feature line and enforced " +
        "NOWHERE. Unticking it would remove the line from the pricing page and " +
        "change nothing about who can use the assistant. Availability is " +
        "decided by lib/features/registry.js, not by this column; the matrix " +
        "therefore claims the assistant on every plan, which is what the code " +
        "actually does.",
      enforcedIn: null,
      // The complete set of files under the two layers where enforcement could
      // live. A NEW name here means somebody wired it up and this note is
      // wrong; the check script fails on exactly that.
      mentionedIn: Object.freeze([
        "app/api/marketing/plans/route.js",
        "lib/billing/planFields.js",
        "lib/features/registry.js",
        "lib/platform/salesKnowledge.js",
      ]),
    }),
  ]),
});

// ── Lookups the renderer will use ──────────────────────────────────────────

const BY_KEY = new Map(FEATURE_MATRIX.map((e) => [e.key, e]));

/** The entry, or undefined. */
export function matrixEntry(key) {
  return BY_KEY.get(key);
}

/** Everything in one group, in declaration order. */
export function entriesForGroup(groupKey) {
  return FEATURE_MATRIX.filter((e) => e.group === groupKey);
}

/**
 * The "included in every plan" list.
 *
 * A function rather than a constant so it stays true by construction. The day
 * one entry becomes varies_by_plan, this list shrinks on its own instead of
 * having to be remembered.
 */
export function includedInEveryPlan() {
  return FEATURE_MATRIX.filter((e) => e.availability === "every_plan");
}

/** The entries a renderer must show with their caveat attached, never as a tick. */
export function partialFeatures() {
  return FEATURE_MATRIX.filter((e) => e.readiness === "partial");
}

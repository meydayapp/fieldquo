// lib/marketing/tierFeatures/roofr.js
//
// Roofr's tier bullets, and what each one of them buys in our terms.
//
// Read on 2026-09-21 from a Canadian connection, off the served HTML of
// roofr.com/pricing: the four plan cards' own bullet lists, quoted as printed,
// plus the "Compare all plan details" table where the cards were silent
// (which plan carries SMS, job costing, crew management, QuickBooks). Nothing
// here is remembered, inferred, or reworded. The same page was read for its
// PRICES into lib/marketing/competitors.js, and the two readings carry the
// same date on purpose — see parity.js, which ages a ladder out whole.
//
// ══ Where Measure+ sits, and why it is on the ladder ══════════════════════
//
// Their card row lists four Base Plans: Starter, Measure+, Essentials, Scale.
// Measure+ is a MEASUREMENT subscription — their table calls it "Add-on
// subscription (monthly) — Upgrade your Starter measurements" — and its card
// reads "The Starter plan, plus:". It is on the ladder because their own
// measurements table marks it "Included" on Essentials and Scale, so the
// cumulative reading (each rung carries the one below) is the reading their
// page supports. It is recorded at its cheaper 6-hour price; the 2-hour
// position ($169) is in competitors.js as its own figure.
//
// ══ The generosity rule, and the two phrases it strains ═══════════════════
//
// Where their phrase plausibly covers ours, it counts. Two are worth the note:
//
//   "10 trial proposals, invoices & work orders" is mapped to our quoting and
//   invoicing keys even though it is a cap of ten in total. A buyer reading it
//   knows it is a trial; the tier's own `limitNote` carries the cap onto the
//   page in their words, beside the $0. Mapping it to nothing would have
//   said Starter cannot quote, which their page does not say.
//
//   "$19 measurement reports delivered in 24 hrs or less" is mapped to our
//   aerial_measure, which measures a roof from the address. That is generous
//   to US, not to them, and it is bounded by the concession recorded against
//   FIELDQUO_CAPABILITIES.measured_roof_report: their report lists measured
//   edges and ours derives the edge split by convention.
//
// The empty arrays are real gaps on our side: ESX files for Xactimate,
// guaranteed delivery time, CSV downloads of measurement data, QuickBooks,
// and "Unlimited users" — which is not a feature but is not nothing either,
// and is carried on the tier as `unlimitedUsers` so the page can say it.

/** Their words on the left, our featureMatrix keys on the right. */
export const TIER_FEATURES = Object.freeze({
  // ── Starter, "Key features:" ───────────────────────────────────────────
  "$19 measurement reports delivered in 24 hrs or less": ["aerial_measure"],
  "1 basic job board": ["jobs"],
  "10 trial proposals, invoices & work orders": ["quotes", "quote_send", "quote_pdf", "invoices", "invoice_send"],
  "5 automated actions": ["follow_ups"],
  "Material ordering & supplier integrations": ["materials"],
  "Email & email templates": ["quote_email_wording"],
  "Calendar & job events": ["scheduling"],
  "ESX files $12 USD / report": [],
  "Unlimited users": [],

  // ── Measure+, "The Starter plan, plus:" ────────────────────────────────
  "$13 measurement reports": ["aerial_measure"],
  "ESX files $10 USD / report": [],
  "2 or 6 hour guaranteed delivery time": [],
  "Material calculations": ["materials", "material_costs"],
  "Waste factor": ["material_costs"],
  "CSV downloads": [],
  "Company logo & branding": ["white_label", "document_layouts"],

  // ── Essentials, "Everything in Starter, plus:" ─────────────────────────
  "$13 measurement reports delivered in 2 hrs or less": ["aerial_measure"],
  "1 flexible job board": ["jobs", "work_areas"],
  "Unlimited proposals, invoices & work orders": ["quotes", "quote_send", "quote_pdf", "invoices", "invoice_send"],
  "10 automated actions": ["follow_ups", "suggested_tasks"],
  "Credit card & ACH payments": ["card_payments"],
  "Signable PDFs & contracts": ["contract_terms", "online_approval"],
  "Unlimited e-signatures": ["online_approval"],

  // ── Scale, "Everything in Essentials, plus:" ───────────────────────────
  "7 customizable job boards": ["jobs"],
  "Custom job tags & work types": ["work_areas"],
  "Crew management": ["crew_shifts", "team_access"],
  "25+ automated actions": ["follow_ups"],
  "Performance dashboard & reporting": ["dashboard", "goals"],
  "Profit margins & job costs": ["job_costing", "break_even"],
  // Same gap Jobber's, QuoteIQ's and Projul's QuickBooks lines record.
  "Quickbooks integration": [],
  "Role-based permissions": ["team_access"],
});

/**
 * Their tiers as published, cheapest first.
 *
 * `monthly` is the card's "Billed monthly" figure and `annualPrepaid` its
 * "/mo billed yearly" one — both read from the price element's own
 * data-monthly / data-annual attributes, never blended. `seatsIncluded` is
 * null on every rung with `unlimitedUsers: true` beside it, because
 * "unlimited" and a seat count are different facts and no calculator should
 * invent a ceiling to divide by.
 */
export const PUBLISHED_TIERS = Object.freeze([
  Object.freeze({
    id: "roofr.starter",
    label: "Starter",
    seatsIncluded: null,
    unlimitedUsers: true,
    monthly: 0,
    annualPrepaid: 0,
    currency: "USD",
    cta: "Start for free",
    bulletHeading: "Key features:",
    // The cap, in their words, printed beside the $0 wherever the page names
    // this tier as their cheapest. A free plan that stops at ten proposals is
    // where a roofer LOOKS, and the page must not let it read as where one
    // runs a business.
    limitNote: "10 trial proposals, invoices & work orders",
    includedFeatures: Object.freeze([
      "$19 measurement reports delivered in 24 hrs or less",
      "1 basic job board",
      "10 trial proposals, invoices & work orders",
      "5 automated actions",
      "Material ordering & supplier integrations",
      "Email & email templates",
      "Calendar & job events",
      "ESX files $12 USD / report",
      "Unlimited users",
    ]),
    source: "https://roofr.com/pricing",
    checked: "2026-09-21",
  }),
  Object.freeze({
    id: "roofr.measure_plus",
    label: "Measure+",
    seatsIncluded: null,
    unlimitedUsers: true,
    monthly: 109,
    annualPrepaid: 95,
    currency: "USD",
    cta: "Get started",
    bulletHeading: "The Starter plan, plus:",
    addsOverPreviousTier: Object.freeze([
      "$13 measurement reports",
      "ESX files $10 USD / report",
      "2 or 6 hour guaranteed delivery time",
      "Material calculations",
      "Waste factor",
      "CSV downloads",
      "Company logo & branding",
      "Unlimited users",
    ]),
    source: "https://roofr.com/pricing",
    checked: "2026-09-21",
  }),
  Object.freeze({
    id: "roofr.essentials",
    label: "Essentials",
    seatsIncluded: null,
    unlimitedUsers: true,
    monthly: 249,
    annualPrepaid: 209,
    currency: "USD",
    cta: "Get started",
    bulletHeading: "Everything in Starter, plus:",
    addsOverPreviousTier: Object.freeze([
      "$13 measurement reports delivered in 2 hrs or less",
      "1 flexible job board",
      "Unlimited proposals, invoices & work orders",
      "10 automated actions",
      "Credit card & ACH payments",
      "Signable PDFs & contracts",
      "Unlimited e-signatures",
      "Unlimited users",
    ]),
    source: "https://roofr.com/pricing",
    checked: "2026-09-21",
  }),
  Object.freeze({
    id: "roofr.scale",
    label: "Scale",
    seatsIncluded: null,
    unlimitedUsers: true,
    monthly: 349,
    annualPrepaid: 299,
    currency: "USD",
    badge: "Most Popular",
    cta: "Get started",
    bulletHeading: "Everything in Essentials, plus:",
    addsOverPreviousTier: Object.freeze([
      "7 customizable job boards",
      "Custom job tags & work types",
      "Crew management",
      "25+ automated actions",
      "Performance dashboard & reporting",
      "Profit margins & job costs",
      "Quickbooks integration",
      "Role-based permissions",
      "Unlimited users",
    ]),
    source: "https://roofr.com/pricing",
    checked: "2026-09-21",
  }),
]);

/**
 * Add-ons priced separately from every tier, quoted as printed at the
 * monthly toggle. Four capabilities FieldQuo puts on every plan are sold by
 * Roofr as $396/mo of extras on top of a plan, and no tier bundles any of
 * them — the honest version of "the plan price is where the bill starts".
 *
 * The SMS entry's `keys` are the honest half on OUR side: FieldQuo texts
 * clients (appointment reminders, on-my-way) and takes texts from crew, and
 * appointment_reminders is `partial` in the matrix — its limits print with it.
 * We do not have a two-way text thread with a homeowner from the job card,
 * and the page must not read as though we do.
 */
export const ADD_ONS = Object.freeze([
  Object.freeze({
    label: "SMS",
    price: 49,
    currency: "USD",
    per: "month",
    keys: Object.freeze(["appointment_reminders", "crew_inbox"]),
    onTiers: Object.freeze(["Essentials", "Scale"]),
    source: "https://roofr.com/pricing",
    checked: "2026-09-21",
  }),
  Object.freeze({
    label: "Instant Estimator",
    price: 149,
    currency: "USD",
    per: "month",
    keys: Object.freeze(["instant_quotes", "self_quote"]),
    source: "https://roofr.com/pricing",
    checked: "2026-09-21",
  }),
  Object.freeze({
    label: "Roofr Sites",
    price: 99,
    currency: "USD",
    per: "month",
    keys: Object.freeze(["website_builder"]),
    source: "https://roofr.com/pricing",
    checked: "2026-09-21",
  }),
  Object.freeze({
    label: "AI Receptionist",
    price: 99,
    currency: "USD",
    per: "month",
    keys: Object.freeze(["voice_receptionist"]),
    source: "https://roofr.com/pricing",
    checked: "2026-09-21",
  }),
]);

/** Anything a reader of the comparison page must know before quoting it. */
export const NOTES = Object.freeze([
  "Roofr does not charge per seat. Every plan card says 'Unlimited users' and their FAQ says so in those words. Any sentence of the form 'Roofr bills every login' is false; the per-head argument that works against Jobber, QuoteIQ and PaintScout does not work here and the page does not make it.",
  "Starter is $0 a month with no time limit, and it caps proposals, invoices and work orders at ten in total ('Trial [10 total]' in their compare table). It is a published price of zero and the page prints it as one, with the cap beside it. It is not a plan a business runs on and the page does not say it is.",
  "Measurement reports are pay-as-you-go on every plan: $19 per report on Starter, $13 on the paid plans, with rush fees on top and a bundle with an ESX file at $31 / $23. 'Guaranteed delivery is met or the report is free' applies to Essentials and Scale. These are in competitors.js as perUseCharges and are printed per report, never folded into a monthly figure — a shop that quotes forty roofs a month pays for forty reports on top of the plan.",
  "SMS is a $49/mo add-on (or $45/mo billed yearly) available only on Essentials and Scale. The Essentials card names 'SMS texting & templates' without a price; the price is in the compare table. The Instant Estimator ($149), Roofr Sites ($99, marked Beta) and AI Receptionist ($99) are add-ons too — $396/mo for all four at the monthly toggle, on top of the plan, and no tier bundles any of them.",
  "Read from a Canadian connection. Their page footer says 'All pricing in USD.' — so a Canadian roofer is shown these figures in US dollars, and the page says so. Roofr Payments is 'U.S businesses only' and the QuickBooks integration is 'Currently only available to businesses located in the US' and marked Beta; both are quoted on the page rather than summarised.",
  "The plan cards are bullet lists headed 'Key features:' and 'Everything in X, plus:'. The compare table below them is the fuller inventory and it is what put job costing, the performance dashboard, crew management and QuickBooks on Scale alone. A capability absent from both is worded 'not listed on their pricing page', never 'Roofr cannot do this'.",
  "Two empty mappings are real gaps on our side and belong in theyHaveWeDont, where they are: the measured report with edge lengths and a delivery guarantee (ours derives the ridge/hip/valley split by convention), and Zapier/CompanyCam, which Roofr includes on every plan. ESX files for Xactimate are a third and are roofing-insurance-specific.",
]);

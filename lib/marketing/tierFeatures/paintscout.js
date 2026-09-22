// lib/marketing/tierFeatures/paintscout.js
//
// PaintScout's tier bullets, and what each one of them buys in our terms.
//
// Read on 2026-09-21 from a Canadian connection, off the served HTML of
// paintscout.com/pricing. Their page has ONE plan, Sales, and one add-on,
// Operations, and its "Feature Breakdown" table has two columns — "Sales" and
// "Sales + Operations" — with a tick or a cross in each. Every phrase below is
// a row of that table, spelled as the table spells it, and which list it
// lands in was read off the two tick marks rather than off the card's prose.
//
// ══ Why Operations is an add-on here and not a second tier ════════════════
//
// Because that is what their page calls it — "Operations — Add-On — $99/mo"
// — and because nobody prints "$218" anywhere on their site. Modelling
// "Sales + Operations" as a $218 tier would put an amount on our page that
// their page does not carry. So the rows ticked only under "Sales +
// Operations" are the add-on's `keys`, and parity.js counts an add-on's keys
// as something they DO sell (at a price the page prints beside the plan)
// rather than as something "not listed on their pricing page".
//
// ══ The generosity rule ═══════════════════════════════════════════════════
//
// "Production Rate Estimating" maps to our paint takeoff, which prices by
// production rate too — hours from rates, gallons from coverage. That is the
// fair mapping and it is also where the page must be careful: PaintScout is a
// painting product with years of painting defaults behind it, and ours ships
// rates recovered from two completed jobs plus stated analogues. The
// concession paragraph on the page says so in words; the mapping says only
// that both products estimate this way.
//
// "Customer Chat" and "Customer chat linked in estimates" map to nothing of
// ours: our client messaging is Facebook, Instagram and WhatsApp
// (lib/messaging/platforms.js), not a chat thread inside the estimate.
// "Sales Leaderboards", "Deal filters & rotting tracking" and "Interactive
// Google Maps for event booking & rep visibility" are sales-team tooling we do
// not have. Empty arrays, so they cannot be counted as ours.

/** Their words on the left, our featureMatrix keys on the right. */
export const TIER_FEATURES = Object.freeze({
  // ── Sales — ticked in the Sales column ─────────────────────────────────
  "Production Rate Estimating": ["paint_takeoff", "quotes"],
  "Interactive Proposals": ["quotes", "quote_send", "quote_pdf", "online_approval"],
  "Customer Chat": [],
  "Sales Leaderboards": [],
  "Integrated Payments": ["card_payments"],
  "Automated Email & SMS": ["follow_ups"],
  "Production rates & material lists": ["paint_takeoff", "materials"],
  "Pre-built templates": ["document_layouts"],
  "Upload photos to estimates": ["job_photos"],
  "Optional upgrades & add-ons": ["add_on_upsell", "priced_options"],
  "Change orders & additional work": ["invoice_changes"],
  "Internal notes on estimates": ["quotes"],
  "Branded presentations": ["white_label", "document_layouts"],
  "Customer chat linked in estimates": [],
  "Proposal viewed/signed notifications": ["online_approval"],
  "eSignature collection": ["online_approval"],
  "Send via email or text": ["quote_send"],
  "Collect deposits and final payments": ["booking_deposit", "card_payments"],
  "Accept ACH and credit cards": ["card_payments"],
  "Wisetack financing integration": ["financing"],
  "Payment status tracking": ["invoices"],
  "Payment links included in estimates": ["online_approval"],
  "Estimate Performance & Close Rates": ["dashboard"],
  "Invoicing & Payments Reports": ["dashboard"],

  // ── Operations — ticked only under "Sales + Operations" ────────────────
  "Automated Reminders & Confirmations": ["appointment_reminders"],
  "Job Management Tools": ["jobs"],
  "Integrated Scheduling": ["scheduling"],
  "Drag & Drop Pipelines": ["leads"],
  "Team Task Management": ["tasks"],
  "Deal Pipeline Automations": ["follow_ups"],
  "Two-way Google Calendar Sync": [],
  "Centralized scheduling calendar": ["scheduling"],
  "Book estimates, visits, follow-ups": ["scheduling", "booking_page"],
  "Interactive Google Maps for event booking & rep visibility": [],
  "Visual sales pipeline": ["leads"],
  "Drag-and-drop board view": ["leads"],
  "Deal filters & rotting tracking": [],
  "Task tracking & assignment": ["tasks"],
  "Full interaction timeline": ["activity_log"],
  "Tags & segmentation": ["clients"],
  "Notes & files": ["clients"],
});

/**
 * Their one tier as published. `perExtraUser` is the "$20/user/month" line
 * beside the card, carried as a number so shopMath in parity.js can price a
 * shop with it — see the note on the figure in competitors.js.
 */
export const PUBLISHED_TIERS = Object.freeze([
  Object.freeze({
    id: "paintscout.sales",
    label: "Sales",
    seatsIncluded: 1,
    perExtraUser: 20,
    monthly: 119,
    annualPrepaid: 99,
    currency: "USD",
    cta: "Get Started",
    bulletHeading: "Key Features",
    includedFeatures: Object.freeze([
      "Production Rate Estimating",
      "Interactive Proposals",
      "Customer Chat",
      "Sales Leaderboards",
      "Integrated Payments",
      "Automated Email & SMS",
      "Production rates & material lists",
      "Pre-built templates",
      "Upload photos to estimates",
      "Optional upgrades & add-ons",
      "Change orders & additional work",
      "Internal notes on estimates",
      "Branded presentations",
      "Customer chat linked in estimates",
      "Proposal viewed/signed notifications",
      "eSignature collection",
      "Send via email or text",
      "Collect deposits and final payments",
      "Accept ACH and credit cards",
      "Wisetack financing integration",
      "Payment status tracking",
      "Payment links included in estimates",
      "Estimate Performance & Close Rates",
      "Invoicing & Payments Reports",
    ]),
    source: "https://www.paintscout.com/pricing",
    checked: "2026-09-21",
  }),
]);

/**
 * The add-on, with the rows their table ticks only beside it. The half of
 * their product that runs the job — scheduling, the pipeline, tasks,
 * reminders — is this, at $99 a month on top of Sales.
 */
export const ADD_ONS = Object.freeze([
  Object.freeze({
    label: "Operations",
    price: 99,
    currency: "USD",
    per: "month",
    keys: Object.freeze([
      "appointment_reminders",
      "jobs",
      "scheduling",
      "leads",
      "tasks",
      "booking_page",
      "activity_log",
    ]),
    phrases: Object.freeze([
      "Automated Reminders & Confirmations",
      "Job Management Tools",
      "Integrated Scheduling",
      "Drag & Drop Pipelines",
      "Team Task Management",
      "Deal Pipeline Automations",
      "Two-way Google Calendar Sync",
      "Centralized scheduling calendar",
      "Book estimates, visits, follow-ups",
      "Interactive Google Maps for event booking & rep visibility",
      "Visual sales pipeline",
      "Drag-and-drop board view",
      "Deal filters & rotting tracking",
      "Task tracking & assignment",
      "Full interaction timeline",
      "Tags & segmentation",
      "Notes & files",
    ]),
    source: "https://www.paintscout.com/pricing",
    checked: "2026-09-21",
  }),
]);

/** Anything a reader of the comparison page must know before quoting it. */
export const NOTES = Object.freeze([
  "PaintScout has one plan and one add-on. Sales is $119/mo billed monthly or $99/mo billed annually, and includes one user. Operations is $99/mo or $79/mo on top. Every extra person is $20/user/month on either. There is no tier above Sales + Operations, and no tier below Sales.",
  "The per-user price is what moves the comparison. A painter with two estimators and four in the field is six users at PaintScout — $119 plus five times $20 — and three seats with four free crew here. That arithmetic is done in the open on the page (shopMath in parity.js) with both inputs printed; it is never a typed number.",
  "Read from a Canadian connection. PaintScout's own Organization markup gives a Calgary, Alberta address, and every price on the page is printed 'in USD' with priceCurrency USD in the Offer markup. A Canadian painter is shown US-dollar prices.",
  "The 14-day trial takes no card — their Offer markup and their footer both say 'no credit card required'. Ours takes a card and does not charge it for a month. That is a point in their favour and the page carries it.",
  "PaintScout is a painting-only product with production-rate defaults built for painters ('Start selling today with default rates already built in', on their painting-estimates page). Ours prices by production rate too — hours from rates, gallons from coverage, situation-named rate sets — and its defaults were recovered from two completed jobs plus stated analogues. The concession paragraph says this in words; no row claims parity of defaults.",
  "'Customer Chat' and 'Customer chat linked in estimates' map to nothing of ours on purpose: our client messaging is Facebook, Instagram and WhatsApp, not a chat thread inside the estimate. Sales leaderboards, deal-rotting filters and the reps-on-a-map view are sales-team tooling we do not have. Word every claim built on an absence as 'not listed on their pricing page'.",
  "The Success Packages ($999, $1,499, $1,999) are one-time onboarding purchases, optional, and are recorded in competitors.js as a note on the demo concession — never as a figure. No monthly comparison on the page carries them.",
]);

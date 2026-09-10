// lib/marketing/tierFeatures/housecall_pro.js
//
// Housecall Pro's tier bullets, and what each one of them buys in our terms.
//
// ══ Why the stored figures were not enough ════════════════════════════════
//
// competitors.js has four Housecall Pro figures, all VERIFIED against served
// HTML, and not one carries `includedFeatures` or `addsOverPreviousTier`. That
// entry was read for PRICES and for the two comparison lists (theyHaveWeDont,
// weHaveTheyDont). So parity.js's `tierLadder("housecall_pro")` maps nothing
// and concludes their $299 Max carries no capability whatsoever — a comparison
// that is not merely weak but visibly wrong to anyone with their tab open.
//
// The bullets below were read fresh from the served HTML of
// housecallpro.com/pricing, parsed out of the page's own
// `block-pricing-plan-cards-2026__feature-copy` spans. That detail matters:
// a text-rendered read of the same page returns each bullet glued to its
// tooltip description with a dash — "Price book - Keep your services up to
// date and accurately priced." — and that composite string appears NOWHERE in
// their markup. Keying on it would have looked right and matched nothing.
// The keys here are the span contents, character for character.
//
// ══ Why exact phrases are the keys ════════════════════════════════════════
//
// Same reason parity.js gives for TIER_MAPPINGS. A fuzzy match ("contains
// 'invoice'") keeps matching after they rewrite a tier, and keeps emitting a
// confident sentence about a plan that no longer says what we think it says.
// An exact key stops matching the moment a word changes: `tierLadder` drops
// the phrase into `unmapped`, the check fails, and a human re-reads their
// page. Failing loudly beats drifting quietly, because the quiet version is
// still live on the site when a rep quotes it down the phone.
//
// Their class name is literally `...-2026__...`, which is a page that gets
// redesigned by the year. Expect this file to need a re-read, and prefer that
// it announce the fact itself.
//
// ══ The generosity rule ═══════════════════════════════════════════════════
//
// Where their phrase plausibly covers ours, it counts. "Estimates &
// invoicing" is mapped to the quote, the PDF, the send, the online approval,
// the invoice and its send, because a buyer reading that bullet assumes all
// six. Winning by reading them uncharitably loses the moment the prospect
// opens the other tab, and a rep is the one left holding it.
//
// `[]` means "read, mapped, we have nothing like it" — a real gap on our side.
// Omitting a phrase would mean "nobody has looked yet". GPS tracking, route
// optimisation, commissions, QuickBooks and an open API are genuinely theirs.

/** Their words on the left, our featureMatrix keys on the right. */
export const TIER_FEATURES = Object.freeze({
  // ── "Included in every Housecall Pro plan" ─────────────────────────────
  //
  // Carried by Basic and therefore by everything above it. Recorded as part of
  // the ladder rather than as trivia, because two of these are capabilities we
  // charge for and one is a capability we do not have at all.
  "Live phone and chat support": [],
  "Free mobile app for iOS and Android": [],
  "Card processing rates as low as 2.59%": ["card_payments"],
  // Mapped generously to our languages key. Ours is English and French, theirs
  // English and Spanish — different pairs, same capability, and a comparison
  // that scored them zero here for picking the other language would be exactly
  // the uncharitable reading this file exists to avoid.
  "App available in English and Spanish": ["languages"],
  "Access to business and consumer financing": ["financing"],
  "Offline viewing": [],
  // Their CSR AI answers calls and their assistant answers questions about the
  // business, so this covers both of ours. Generous by design.
  "AI team members to automate your work": ["ai_copilot", "voice_receptionist"],
  "Community of 30,000+ home service Pros": [],

  // ── Basic, "Everything included, plus:" ────────────────────────────────
  "Online booking": ["booking_page", "booking_deposit"],
  "Scheduling & dispatch": ["scheduling", "jobs", "crew_shifts"],
  "Estimates & invoicing": [
    "quotes",
    "quote_send",
    "quote_pdf",
    "online_approval",
    "invoices",
    "invoice_send",
  ],
  "Payments & consumer financing": ["card_payments", "financing"],
  "Price book": ["price_book"],
  "Job costing": ["job_costing", "materials"],
  "Review management": ["review_requests", "testimonials"],

  // ── Essentials, "All Basic features, plus:" ────────────────────────────
  //
  // Job routing, not our door-hanger routes — those are a marketing walk-list
  // and mapping them here would claim a capability we do not have. parity.js
  // scores QuoteIQ's "route optimisation" as [] for the same reason.
  Routes: [],
  "Flat-rate pricing": ["price_book", "break_even"],
  "Checklist automations": ["checklists"],
  "Photo reports & annotations": ["job_photos"],
  "Employee GPS tracking": [],
  Commissions: [],
  "QuickBooks Online sync": [],

  // ── Max, "Everything in Essentials, plus:" ─────────────────────────────
  //
  // The dollar figure is part of the bullet as printed. Kept verbatim: strip
  // it and the key silently stops matching their page.
  "Sales proposal tool ($40/mo value)": ["priced_options", "document_layouts", "quote_pdf"],
  "Recurring Service Plans": ["service_plans", "recurring_jobs"],
  "Route optimization": [],
  "Open API access": [],
  "Dedicated onboarding specialist": [],
  "Escalated phone support": [],
});

/**
 * Their tiers as published, because competitors.js carries none of this.
 *
 * Prices as printed: annual-prepaid first, no-commitment monthly second. Both
 * recorded, never blended. Seat counts are quoted from their own markup, which
 * says "8 user included" — their typo, kept, because the value of a verbatim
 * field is that it can be diffed against the page later.
 *
 * `includedFeatures` on Basic, `addsOverPreviousTier` above it — the shape
 * parity.js's `tierLadder` already accumulates.
 */
export const PUBLISHED_TIERS = Object.freeze([
  Object.freeze({
    id: "housecall_pro.basic",
    label: "Basic",
    seatsIncluded: 1,
    seatsAsPrinted: "1 user included",
    annualPrepaid: 59,
    monthly: 79,
    currency: "USD",
    cta: "Get Started",
    bulletHeading: "Everything included, plus:",
    // The every-plan list first, then Basic's own bullets. Basic is the floor,
    // so both are "included" here in the sense tierLadder means.
    includedFeatures: Object.freeze([
      "Live phone and chat support",
      "Free mobile app for iOS and Android",
      "Card processing rates as low as 2.59%",
      "App available in English and Spanish",
      "Access to business and consumer financing",
      "Offline viewing",
      "AI team members to automate your work",
      "Community of 30,000+ home service Pros",
      "Online booking",
      "Scheduling & dispatch",
      "Estimates & invoicing",
      "Payments & consumer financing",
      "Price book",
      "Job costing",
      "Review management",
    ]),
    source: "https://www.housecallpro.com/pricing/",
    checked: "2026-09-09",
  }),
  Object.freeze({
    id: "housecall_pro.essentials",
    label: "Essentials",
    seatsIncluded: 5,
    seatsAsPrinted: "5 users included",
    additionalUserPrice: 100,
    annualPrepaid: 149,
    monthly: 189,
    currency: "USD",
    badge: "Recommended",
    cta: "Get Started",
    bulletHeading: "All Basic features, plus:",
    addsOverPreviousTier: Object.freeze([
      "Routes",
      "Flat-rate pricing",
      "Checklist automations",
      "Photo reports & annotations",
      "Employee GPS tracking",
      "Commissions",
      "QuickBooks Online sync",
    ]),
    source: "https://www.housecallpro.com/pricing/",
    checked: "2026-09-09",
  }),
  Object.freeze({
    id: "housecall_pro.max",
    label: "Max",
    seatsIncluded: 8,
    seatsAsPrinted: "8 user included",
    additionalUserPrice: 75,
    annualPrepaid: 299,
    monthly: 329,
    currency: "USD",
    // Their top tier asks for a demo and still prints its price. Both are true
    // at once, which is why the CTA is its own field.
    cta: "Book Demo",
    bulletHeading: "Everything in Essentials, plus:",
    addsOverPreviousTier: Object.freeze([
      "Sales proposal tool ($40/mo value)",
      "Recurring Service Plans",
      "Route optimization",
      "Open API access",
      "Dedicated onboarding specialist",
      "Escalated phone support",
    ]),
    source: "https://www.housecallpro.com/pricing/",
    checked: "2026-09-09",
  }),
]);

/** Anything a reader of the comparison page must know before quoting it. */
export const NOTES = Object.freeze([
  "Housecall Pro prices PER SEAT above the included count, and the overage is the real number: $100/mo per extra user on Essentials, $75/mo on Max. A six-person shop on Essentials is $149 + $100 = $249/mo, not $149. Any comparison that quotes the sticker price and stops has quoted the wrong number.",
  "The monthly figures ($79 / $189 / $329) are the no-commitment rate; the headline figures ($59 / $149 / $299) require paying a year up front. Never present the annual-prepaid number beside a FieldQuo monthly number without saying so.",
  "Their bullets are SHORT phrases in the markup ('Price book'), each with a longer tooltip description beside it. A text-rendered read of the page glues the two together with a dash into strings that do not exist in their HTML. The keys in this file are the markup spans. If a future re-read produces dashed composites, it read the rendered text, not the page.",
  "Their pricing block's own CSS class is `block-pricing-plan-cards-2026__…`. A yearly redesign is signposted in their markup; treat these phrases as having a shelf life and let the unmapped check catch it.",
  "The every-plan list is quoted here in full and three of its items are already recorded in competitors.js as theyHaveWeDont — the mobile app, offline viewing, and the tailored demo. Mapping them to [] here is the same finding, not a new one, and the two must not be double-counted on the page.",
  "'AI team members to automate your work' is mapped generously to both our AI copilot and our AI receptionist. It is a single vague marketing phrase covering their CSR AI; if a claim on the page turns on whether they answer calls, verify it against their product pages rather than resting on this bullet.",
  "Five empty mappings are real gaps on our side: employee GPS tracking, commissions, QuickBooks Online sync, route optimisation, and open API access. Contractors ask for GPS and QuickBooks constantly. They belong in theyHaveWeDont, not in silence.",
  "These bullets are a HIGHLIGHT list, not an inventory. Their tiers list no client list and no reporting anywhere, and Housecall Pro obviously has both — the page simply does not sell on them. So a capability's absence from this mapping proves only that it is 'not listed on their pricing page', which is checkable and fair. Never render it as 'Housecall Pro cannot do this'; the first prospect who knows otherwise discredits the whole page, including the parts that are true.",
]);

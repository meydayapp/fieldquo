// lib/marketing/tierFeatures/jobber.js
//
// Jobber's tier bullets, and what each one of them buys in our terms.
//
// ══ Why the stored figures were not enough ════════════════════════════════
//
// competitors.js has thirteen Jobber figures, all VERIFIED, and not one of
// them carries `includedFeatures` or `addsOverPreviousTier`. Whoever read that
// page read it for PRICES. So parity.js's `tierLadder("jobber")` currently
// walks every tier, maps nothing, and reports that Jobber's $599 Plus carries
// no capability at all — which is not a strong comparison, it is a broken one,
// and a prospect spots it in one glance at their page.
//
// The bullets below were therefore read fresh, twice and by two different
// mechanisms: once through a text fetch of getjobber.com/pricing, and once in
// a real browser, where the team-size selector had to be moved off "Just me"
// before Plus appeared at all. Both reads returned byte-identical bullets.
// Nothing here is remembered, inferred, or reworded.
//
// ══ Why exact phrases are the keys ════════════════════════════════════════
//
// Same reason parity.js gives for TIER_MAPPINGS, and it is worth restating
// because this file is the one that rots first. A fuzzy or normalised match
// ("contains 'invoice'") would keep on matching after Jobber rewrites a tier,
// and would keep on producing a confident sentence about a plan that no longer
// says what we think it says. An exact key stops matching the moment they
// change a word — `tierLadder` puts the phrase in `unmapped`, the check fails,
// and a human re-reads their page. A comparison page that fails loudly is
// worth more than one that drifts quietly, because the quiet one is still on
// the site when a rep quotes it down the phone.
//
// ══ The generosity rule ═══════════════════════════════════════════════════
//
// Where their phrase plausibly covers ours, it counts. "Send professional
// quotes" is mapped to the PDF and the send as well as the quote itself,
// because a buyer reading that bullet reasonably assumes all three. Winning by
// reading them uncharitably loses the moment the prospect opens the other tab.
//
// The empty arrays are the other half of the same honesty: `[]` means "read,
// mapped, and we have nothing like it" — a real gap on our side — as opposed
// to an omitted phrase, which means nobody has looked at it yet. QuickBooks,
// the app marketplace and onboarding specialists are genuinely theirs.

/** Their words on the left, our featureMatrix keys on the right. */
export const TIER_FEATURES = Object.freeze({
  // ── Core, "Key features:" ──────────────────────────────────────────────
  "Book and schedule jobs online": ["booking_page", "scheduling", "jobs"],
  "Send professional quotes": ["quotes", "quote_send", "quote_pdf"],
  "Send invoices and receive online payments": ["invoices", "invoice_send", "card_payments"],
  "Create a professional website": ["website_builder"],
  "Track performance with built-in reporting": ["dashboard"],
  // No FieldQuo equivalent, and no plan to build one. An integrations
  // marketplace is a genuine reason to choose them and belongs in
  // theyHaveWeDont rather than being quietly dropped from the ladder.
  "Connect 100+ tools through the app marketplace": [],

  // ── Connect, "All Core features, plus:" ────────────────────────────────
  "Send automated client reminders": ["appointment_reminders"],
  "Collect payments automatically": ["card_payments"],
  "Standardize job documentation with checklists": ["checklists"],
  "Automate quote and invoice follow-ups": ["follow_ups"],
  // Same gap QuoteIQ's "QuickBooks integration" records. Ours is the only
  // product in this comparison that does not sync to an accountant's ledger.
  "Sync with QuickBooks Online": [],
  "Track time and expenses": ["time_clock", "timesheets", "expenses"],

  // ── Grow, "All Connect features, plus:" ────────────────────────────────
  // "rich visuals and reviews" is images plus testimonials ON the quote, which
  // is our document layout and our testimonials, not our job photos.
  "Customize quotes with rich visuals and reviews": ["document_layouts", "testimonials"],
  "Upsell services with optional line items": ["add_on_upsell", "priced_options"],
  "Track time automatically": ["time_clock"],
  "Track profitability with job costing": ["job_costing"],
  // Read generously as customer messaging, which is where crew_inbox lands in
  // this codebase — parity.js maps QuoteIQ's "in-app calling and texting" the
  // same way, and the two competitors should not be scored differently for
  // describing the same feature in different words.
  "Connect with customers through two-way SMS": ["crew_inbox"],
  "Build custom workflow automations": ["follow_ups", "suggested_tasks"],

  // ── Plus, "All Grow features, plus:" ───────────────────────────────────
  "Centralize job files and media for quick reuse across Jobber": ["job_photos"],
  "Tag teammates in job notes to keep everyone accountable": ["tasks", "crew_inbox"],
  "Automate job costing and profitability tracking": ["job_costing"],
  "Track every lead with Pipeline": ["leads"],
  "Re-engage customers with Marketing Suite": ["email_campaigns"],
  "Never miss a lead with an AI-powered Receptionist": ["voice_receptionist"],
  "Get started faster with a dedicated onboarding specialist": [],
  "Get priority help with Premium Support": [],
});

/**
 * Their tiers as published, because competitors.js carries none of this.
 *
 * Jobber prices by TEAM-SIZE BAND, not per seat, so a tier is not one row —
 * it is one row per band, and the same bullets hang off every band. Both bands
 * read here are recorded: "Just me", where Plus is not sold at all, and "2-5
 * people", where it is. Nothing was extrapolated to the 6-10, 11-15 or 16+
 * bands; those exist on their page and are simply not read here.
 *
 * `includedFeatures` on the base tier of each band, `addsOverPreviousTier`
 * above it — the shape parity.js's `tierLadder` already accumulates.
 */
export const PUBLISHED_TIERS = Object.freeze([
  // ── Team size "Just me" ────────────────────────────────────────────────
  Object.freeze({
    id: "jobber.core.solo",
    label: "Core",
    teamSize: "solo",
    seatsIncluded: 1,
    monthly: 49,
    annualPrepaid: 29,
    currency: "USD",
    cta: "Try Jobber For Free",
    bulletHeading: "Key features:",
    includedFeatures: Object.freeze([
      "Book and schedule jobs online",
      "Send professional quotes",
      "Send invoices and receive online payments",
      "Create a professional website",
      "Track performance with built-in reporting",
      "Connect 100+ tools through the app marketplace",
    ]),
    source: "https://www.getjobber.com/pricing/",
    checked: "2026-09-09",
  }),
  Object.freeze({
    id: "jobber.connect.solo",
    label: "Connect",
    teamSize: "solo",
    seatsIncluded: 1,
    monthly: 139,
    annualPrepaid: 99,
    currency: "USD",
    badge: "Recommended",
    cta: "Try Jobber For Free",
    bulletHeading: "All Core features, plus:",
    addsOverPreviousTier: Object.freeze([
      "Send automated client reminders",
      "Collect payments automatically",
      "Standardize job documentation with checklists",
      "Automate quote and invoice follow-ups",
      "Sync with QuickBooks Online",
      "Track time and expenses",
    ]),
    source: "https://www.getjobber.com/pricing/",
    checked: "2026-09-09",
  }),
  Object.freeze({
    id: "jobber.grow.solo",
    label: "Grow",
    teamSize: "solo",
    seatsIncluded: 1,
    monthly: 199,
    annualPrepaid: 149,
    currency: "USD",
    cta: "Try Jobber For Free",
    bulletHeading: "All Connect features, plus:",
    addsOverPreviousTier: Object.freeze([
      "Customize quotes with rich visuals and reviews",
      "Upsell services with optional line items",
      "Track time automatically",
      "Track profitability with job costing",
      "Connect with customers through two-way SMS",
      "Build custom workflow automations",
    ]),
    source: "https://www.getjobber.com/pricing/",
    checked: "2026-09-09",
  }),
  // Recorded rather than omitted: "they do not sell Plus to a one-person shop"
  // is a fact about their product, and a missing row reads as an oversight.
  Object.freeze({
    id: "jobber.plus.solo",
    label: "Plus",
    teamSize: "solo",
    seatsIncluded: null,
    monthly: null,
    annualPrepaid: null,
    currency: "USD",
    notOffered: true,
    source: "https://www.getjobber.com/pricing/",
    checked: "2026-09-09",
  }),

  // ── Team size "2-5 people", where every tier says "Includes 5 users" ───
  Object.freeze({
    id: "jobber.connect.2-5",
    label: "Connect",
    teamSize: "2-5",
    seatsIncluded: 5,
    monthly: 199,
    annualPrepaid: 149,
    currency: "USD",
    cta: "Try Jobber For Free",
    bulletHeading: "All Core features, plus:",
    // Core is not sold at this band, so Connect is the floor here and carries
    // Core's list as included rather than as an addition to a tier a buyer at
    // this team size cannot actually buy.
    includedFeatures: Object.freeze([
      "Book and schedule jobs online",
      "Send professional quotes",
      "Send invoices and receive online payments",
      "Create a professional website",
      "Track performance with built-in reporting",
      "Connect 100+ tools through the app marketplace",
      "Send automated client reminders",
      "Collect payments automatically",
      "Standardize job documentation with checklists",
      "Automate quote and invoice follow-ups",
      "Sync with QuickBooks Online",
      "Track time and expenses",
    ]),
    source: "https://www.getjobber.com/pricing/",
    checked: "2026-09-09",
  }),
  Object.freeze({
    id: "jobber.grow.2-5",
    label: "Grow",
    teamSize: "2-5",
    seatsIncluded: 5,
    monthly: 299,
    annualPrepaid: 229,
    currency: "USD",
    cta: "Try Jobber For Free",
    bulletHeading: "All Connect features, plus:",
    addsOverPreviousTier: Object.freeze([
      "Customize quotes with rich visuals and reviews",
      "Upsell services with optional line items",
      "Track time automatically",
      "Track profitability with job costing",
      "Connect with customers through two-way SMS",
      "Build custom workflow automations",
    ]),
    source: "https://www.getjobber.com/pricing/",
    checked: "2026-09-09",
  }),
  Object.freeze({
    id: "jobber.plus.2-5",
    label: "Plus",
    teamSize: "2-5",
    seatsIncluded: 5,
    monthly: 499,
    annualPrepaid: 399,
    currency: "USD",
    badge: "Recommended",
    // The price is printed AND the button asks you to call. Not opposites.
    cta: "Contact Sales",
    bulletHeading: "All Grow features, plus:",
    addsOverPreviousTier: Object.freeze([
      "Centralize job files and media for quick reuse across Jobber",
      "Tag teammates in job notes to keep everyone accountable",
      "Automate job costing and profitability tracking",
      "Track every lead with Pipeline",
      "Re-engage customers with Marketing Suite",
      "Never miss a lead with an AI-powered Receptionist",
      "Get started faster with a dedicated onboarding specialist",
      "Get priority help with Premium Support",
    ]),
    source: "https://www.getjobber.com/pricing/",
    checked: "2026-09-09",
  }),
]);

/**
 * Add-ons priced separately from every tier, quoted as printed.
 *
 * These matter to the comparison more than any bullet does: three capabilities
 * FieldQuo puts on every plan are sold by Jobber as $177/mo of extras on top
 * of a tier — unless the buyer reaches Plus, which bundles all three. That is
 * the honest version of "the cheaper plans do not compare", in their own
 * product's terms. They are NOT folded into TIER_FEATURES, because a paid
 * extra is not something the tier carries.
 */
export const ADD_ONS = Object.freeze([
  Object.freeze({
    label: "Marketing Suite",
    price: 99,
    currency: "USD",
    per: "month",
    keys: Object.freeze(["email_campaigns"]),
    bundledInto: "Plus",
    source: "https://www.getjobber.com/pricing/",
    checked: "2026-09-09",
  }),
  Object.freeze({
    label: "Jobber AI Receptionist",
    price: 29,
    currency: "USD",
    per: "month",
    keys: Object.freeze(["voice_receptionist"]),
    bundledInto: "Plus",
    source: "https://www.getjobber.com/pricing/",
    checked: "2026-09-09",
  }),
  Object.freeze({
    label: "Sales Pipeline",
    price: 49,
    currency: "USD",
    per: "month",
    keys: Object.freeze(["leads"]),
    bundledInto: "Plus",
    source: "https://www.getjobber.com/pricing/",
    checked: "2026-09-09",
  }),
]);

/** Anything a reader of the comparison page must know before quoting it. */
export const NOTES = Object.freeze([
  "Jobber prices by TEAM-SIZE BAND, not per seat. The same tier has a different price at 'Just me' than at '2-5 people', and the bands jump — there is no six-person price, only a 6-10 one. Any sentence of the form 'Jobber costs $X' is false unless it names the band.",
  "Plus is not offered at all to a one-person shop. Core is not offered at '2-5 people'. The ladder a buyer sees depends on the team size they pick first.",
  "Read from a US connection. Jobber is a Canadian company and may serve CAD to a Canadian visitor — and Canada is most of who FieldQuo competes for. Their page footer says 'All prices in USD'; that is what a US visitor is shown, not a global fact. Re-check before quoting these as 'Jobber's price' rather than 'Jobber's US price'.",
  "Every tier shows two figures, a struck-through /mo and a lower 'Billed annually' /mo. This file records both (monthly, annualPrepaid) and never blends them. competitors.js flagged the relationship between these two numbers as `unresolved`; the page now labels them plainly, so a re-read of that file would resolve it — not done here, because this file was scoped to features and rewriting price figures nobody asked for is how a wrong number gets shipped.",
  "Marketing Suite ($99/mo), AI Receptionist ($29/mo) and Sales Pipeline ($49/mo) are paid add-ons at every tier below Plus. A Grow buyer who wants what FieldQuo includes as standard pays Grow plus up to $177/mo. This is the strongest true line available on this competitor and it is computed from their own page.",
  "The Core bullet list is headed 'Key features:', not 'Everything included, plus:'. It is a highlight list, so a capability absent from it is not proven absent from the plan — the page never claims the list is exhaustive. Word every claim as 'not listed on their pricing page', which is checkable, and never as 'Jobber cannot do this'.",
  "Three empty mappings are real gaps on our side, not scoring choices: QuickBooks Online sync, the 100+ tool app marketplace, and dedicated onboarding/premium support. All three are ordinary reasons to pick Jobber and belong in theyHaveWeDont.",
  "Concrete proof the lists are not inventories: no tier bullet mentions a client list, yet Jobber's own site footer links 'Client manager (CRM)' as a headline feature. The mapping says only what their PRICING page says. Any claim built on an absence must be worded 'not listed on their pricing page' — the first prospect who knows better discredits the whole page, including the parts that are true.",
]);

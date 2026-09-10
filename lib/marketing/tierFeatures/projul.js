// lib/marketing/tierFeatures/projul.js
//
// Projul's tier bullets, and what each one of them buys in our terms.
//
// ══ Why this file exists when competitors.js already had feature lists ════
//
// Jobber's and Housecall Pro's stored figures carried prices and no bullets at
// all. Projul is the opposite problem and the more dangerous one: its three
// figures DO carry `includedFeatures` / `addsOverPreviousTier`, so a reader
// would reasonably assume the phrases were read off their page. They were not.
// Every one of them is `featuresSourcing: "owner_relayed"` — the owner typed
// them out from memory of the page, lowercased and lightly reworded ("CRM",
// "photo capture and markup", "QuickBooks Online"). The page says "CRM & Sales
// Tools", "Photo Capture, Markup & Galleries", "QuickBooks® Online
// Integration". Nothing he gave was WRONG; it was not verbatim, and verbatim
// is the whole mechanism here — an exact-phrase key that has been normalised
// is an exact-phrase key that matches nothing.
//
// competitors.js says so itself, in the note attached to every Projul figure:
// "Somebody should re-read projul.com/pricing for exactly that reason." This
// is that re-read. The served HTML at https://projul.com/pricing/ was fetched
// on 2026-09-09 and the bullets were extracted from the `pricing-card__feature`
// list items inside the three `pricing-card` blocks, one card at a time, with
// the check-mark <svg> stripped and HTML entities decoded. Nothing below is
// remembered, inferred, reworded, or carried over from the stored lists.
//
// Two traps in that extraction, both real, both avoided:
//   - `&amp;` and `&hellip;` are entities in the markup. The string a renderer
//     must match is the DECODED one ("CRM & Sales Tools"), because that is what
//     a human reading their page sees and what a human re-checking this file
//     will search for. Keys below are decoded.
//   - "QuickBooks® Online Integration" carries a literal U+00AE. Dropping it
//     would produce a phrase that appears nowhere in their markup — the same
//     class of mistake as Housecall Pro's rendered-text bullet/tooltip glue.
//
// ══ Why exact phrases are the keys ════════════════════════════════════════
//
// Same reason parity.js gives for TIER_MAPPINGS, restated because this file is
// the one that rots first. A fuzzy match ("contains 'invoice'") keeps matching
// after Projul rewrites a tier and keeps producing a confident sentence about
// a plan that no longer says what we think it says. An exact key stops matching
// the moment they change a word: `tierLadder` drops the phrase into `unmapped`,
// the check fails, and a human re-reads their page. A comparison page that
// fails loudly beats one that drifts quietly, because the quiet one is still on
// the site when a rep quotes it down the phone.
//
// ══ The generosity rule ═══════════════════════════════════════════════════
//
// Where their phrase plausibly covers ours, it counts. "Estimating" is mapped
// to the send and the PDF as well as the quote itself, because a buyer reading
// that bullet on a product that also sells eSignatures reasonably assumes all
// three. Winning by reading them uncharitably loses the moment the prospect
// opens the other tab.
//
// The empty arrays are the other half of the same honesty: `[]` means "read,
// mapped, and we have nothing like it" — a real gap on our side — as opposed to
// an omitted phrase, which means nobody has looked at it yet. The mobile app,
// Gantt charts, purchase orders, daily logs, geofencing, QuickBooks and
// progress billing are genuinely theirs.

/** Their words on the left, our featureMatrix keys on the right. */
export const TIER_FEATURES = Object.freeze({
  // ── Core, $4,788/yr ────────────────────────────────────────────────────
  // A project in their vocabulary is a job in ours. "Unlimited" is a limit
  // statement rather than a capability, but the capability underneath it is
  // the job record, and a buyer reads the bullet as "you get jobs".
  "Unlimited Projects": ["jobs"],
  // Same reading parity.js already gives ServiceTitan's bare "CRM". Their nav
  // splits it into "CRM / Track leads" and "Lead Management", so both halves
  // are theirs and both are ours.
  "CRM & Sales Tools": ["clients", "leads"],
  // parity.js maps QuoteIQ's "e-signatures" to online_approval on the same
  // reasoning: ours also takes a deposit at the same moment, which is more
  // than they claim, and a comparison does not get to charge them for that.
  "eSignatures": ["online_approval"],
  // No FieldQuo equivalent and none planned. This is the concession that costs
  // most, because it sits on their CHEAPEST tier: a contractor comparing entry
  // tiers gets a native app from them and a web page from us. Already recorded
  // in competitors.js `theyHaveWeDont` as `mobile_app`; the empty array here is
  // the same admission in the ladder's own terms.
  "Full Featured Mobile App": [],
  "Estimating": ["quotes", "quote_send", "quote_pdf"],
  "Invoicing & Payment Processing": ["invoices", "invoice_send", "card_payments"],
  // parity.js maps QuoteIQ's "website contact form" the same way. Two
  // competitors describing the same thing differently must not score
  // differently.
  "Lead Capture Form": ["lead_form"],
  // Push notifications to a native app we do not have. Not appointment
  // reminders — those are a separate Pro bullet on their own page, and
  // conflating the two would credit Core with something Core does not claim.
  "Mobile Notifications": [],
  "Photo Capture, Markup & Galleries": ["job_photos"],
  "Project Management": ["jobs"],
  "Reporting": ["dashboard"],
  "Scheduling & Calendars": ["scheduling", "jobs"],
  "Task Management": ["tasks"],
  // Their own nav glosses this as "Standardize estimates and proposals", which
  // is our document layout. NOT price_book: the reusable-cost-group half of
  // "templates" is sold separately as "Assemblies" at Pro, and mapping both
  // here would give Core a capability their page puts two tiers up.
  "Templates": ["document_layouts"],
  // Included in the tier price, and it is the $4,500 package below. Onboarding,
  // training and data import are a real gap — ours is a paid migration service,
  // theirs is free with the plan. See ADD_ONS.
  "Premium Support Package": [],

  // ── Core+, $7,188/yr, "All Core features plus…" ────────────────────────
  // Read generously: the underlying capability is "manage the subs you use",
  // and subcontractor_bids is the nearest thing we sell. Our own matrix entry
  // admits it is `partial` — no list of subs, no way to put one on a job — so
  // this mapping flatters us more than it flatters them, which is the right
  // direction for the error to run.
  "Unlimited Subcontractors": ["subcontractor_bids"],
  // A change order is a priced variation the client re-approves. Ours amends an
  // issued invoice and keeps the old one. Not identical — theirs is a document
  // in its own right — but the buyer's question ("can I bill for the extra work
  // without arguing about it later?") is answered by both.
  "Change Orders": ["invoice_changes"],
  "Client Portal": ["client_portal"],
  "Construction Financials, Job Costing & Budgeting": ["job_costing", "expenses", "break_even"],
  // Their pitch is one click from a won bid to the crew's task list. Ours turns
  // an approved quote into a job with its work; same motion, different nouns.
  "Convert Estimates to Tasks": ["jobs", "tasks"],
  // FieldQuo schedules visits on a calendar and holds no dependencies between
  // tasks. That is a missing MODEL, not a missing screen, and answering it with
  // our calendar is the kind of dodge a prospect catches in one demo.
  "Gantt Charts": [],
  "Linear Project Timelines": [],
  // Two things in one bullet: crew messaging (crew_inbox) and client messaging
  // through the portal. parity.js reads Jobber's "two-way SMS" and QuoteIQ's
  // "in-app calling and texting" as crew_inbox, so the crew half follows
  // precedent; the client half is what their portal bullet above already buys.
  "Messaging & Channeled Communications": ["crew_inbox", "client_portal"],
  // Billing by milestone or percentage. We take a deposit against ONE invoice —
  // lib/invoices/invoiceNumber.js says in as many words that there is no
  // split-invoice model to number. A partial payment is not a staged bill, and
  // pretending otherwise falls over the first time a remodeller asks.
  "Progress Billing": [],
  "Time Tracking": ["time_clock", "timesheets"],
  // The one an established shop asks about first. docs/INTEGRATIONS-ASSESSMENT.md
  // is the honest counterweight and belongs beside this rather than replacing
  // it: what they describe is a one-way push and our bookkeeping CSV covers much
  // of the same ground. It is still a gap.
  "QuickBooks® Online Integration": [],

  // ── Pro, $14,388/yr, "All other features plus…" ────────────────────────
  // parity.js already maps QuoteIQ's "unlimited users" to []. We charge per
  // seat; that is a pricing model, not a capability, and team_access is not it.
  // The interesting fact about this bullet is WHERE it sits — see NOTES.
  "Unlimited Users": [],
  // Their nav: "Reusable cost groups for fast estimates". That is our price book
  // plus the material recipe that says how much of what a job this size eats.
  "Assemblies": ["price_book", "material_costs"],
  // Both, and deliberately: their nav glosses it as "Never chase a payment
  // again", which is quote/invoice follow-up, while the bullet's own words say
  // client reminders, which is the appointment. Mapping only one would lose
  // half of what the phrase claims.
  "Automated Client Reminders": ["appointment_reminders", "follow_ups"],
  // General-contracting features. Less relevant to a one-van painter, which is
  // an argument about fit and not a reason to leave them off the page.
  "Daily Logs": [],
  "Geolocation & Geofencing": [],
  "Photo Reports": ["job_photos"],
  // We have materials and expenses on a job; we have no document you send a
  // supplier.
  "Purchase Orders": [],
  // QuickBooks Desktop we have refused outright, so this one will not close.
  "QuickBooks® Desktop Integration": [],
  // Mapped rather than left empty, and the distinction matters: our booking
  // engine PREVENTS the overlap (lib/booking/computeAvailability.js blocks every
  // candidate overlapping a taken slot) instead of reporting it afterwards. An
  // empty array here would publish "FieldQuo cannot handle double-bookings",
  // which is false. It adds nothing new at Pro because scheduling is already
  // carried at Core, which is the correct outcome.
  "Schedule Conflicts": ["scheduling"],
  // "Let clients pick finishes online" — a priced choice the homeowner makes on
  // the document. That is our tiered options and our tickable add-ons. Note
  // priced_options is `partial` in our own matrix: the pricing works, the screen
  // does not exist yet. Do not let this mapping become a claim it is finished.
  "Selections": ["priced_options", "add_on_upsell"],
  // "Turn tracked hours into paid invoices". Not our service_plans, which is a
  // recurring maintenance contract — a different product entirely, and the
  // similar name is a trap.
  "Service Invoicing": ["invoices", "timesheets"],
  // Our `languages` key is English and French, and our own matrix entry says
  // Spanish is translated but NOT switched on. Their Spanish ships. Mapping this
  // to `languages` would let the ladder claim parity on the one language a
  // crew-heavy contractor in Texas or California actually asks about.
  "Spanish App Translation": [],
});

/**
 * Their tiers as published, because the stored figures carry relayed phrases.
 *
 * Three tiers, one axis, no team-size bands and no monthly column: every card
 * says "Annually" and their FAQ says outright they cannot offer a monthly
 * option. So unlike Jobber there is exactly one row per tier and no second
 * price to keep straight.
 *
 * `annual` rather than jobber.js's `monthly`/`annualPrepaid` pair, because
 * there is no monthly figure to record and inventing one by dividing by twelve
 * is precisely the kind of number that ends up quoted as theirs.
 */
export const PUBLISHED_TIERS = Object.freeze([
  Object.freeze({
    id: "projul.core",
    label: "Core",
    annual: 4788,
    currency: "USD",
    cta: "Schedule a demo",
    includedFeatures: Object.freeze([
      "Unlimited Projects",
      "CRM & Sales Tools",
      "eSignatures",
      "Full Featured Mobile App",
      "Estimating",
      "Invoicing & Payment Processing",
      "Lead Capture Form",
      "Mobile Notifications",
      "Photo Capture, Markup & Galleries",
      "Project Management",
      "Reporting",
      "Scheduling & Calendars",
      "Task Management",
      "Templates",
      "Premium Support Package",
    ]),
    source: "https://projul.com/pricing/",
    checked: "2026-09-09",
  }),
  Object.freeze({
    id: "projul.core_plus",
    label: "Core+",
    annual: 7188,
    currency: "USD",
    // Their own markup flags this card `pricing-card--featured`; it is the one
    // they steer a visitor to, and it is also the tier their ROI calculator
    // subtracts as "Investment in Projul -$7,188".
    badge: "Featured",
    cta: "Schedule a demo",
    bulletHeading: "All Core features plus…",
    addsOverPreviousTier: Object.freeze([
      "Unlimited Subcontractors",
      "Change Orders",
      "Client Portal",
      "Construction Financials, Job Costing & Budgeting",
      "Convert Estimates to Tasks",
      "Gantt Charts",
      "Linear Project Timelines",
      "Messaging & Channeled Communications",
      "Progress Billing",
      "Time Tracking",
      "QuickBooks® Online Integration",
    ]),
    source: "https://projul.com/pricing/",
    checked: "2026-09-09",
  }),
  Object.freeze({
    id: "projul.pro",
    label: "Pro",
    annual: 14388,
    currency: "USD",
    cta: "Schedule a demo",
    // "All OTHER features plus…", not "All Core+ features plus…". Read as
    // cumulative, which is the generous reading and almost certainly the
    // intended one, but recorded verbatim because it is not the same sentence.
    bulletHeading: "All other features plus…",
    addsOverPreviousTier: Object.freeze([
      "Unlimited Users",
      "Assemblies",
      "Automated Client Reminders",
      "Daily Logs",
      "Geolocation & Geofencing",
      "Photo Reports",
      "Purchase Orders",
      "QuickBooks® Desktop Integration",
      "Schedule Conflicts",
      "Selections",
      "Service Invoicing",
      "Spanish App Translation",
    ]),
    source: "https://projul.com/pricing/",
    checked: "2026-09-09",
  }),
]);

/**
 * Priced separately on their page — and it goes the other way from Jobber's.
 *
 * Jobber's add-ons were the strongest true line against them: $177/mo of extras
 * below Plus for things we include. Projul's single separately-priced item is
 * $4,500 of onboarding that is FREE on every plan, and since every plan is
 * annual it is free full stop. Recorded anyway, and recorded honestly, because
 * a renderer that only ever surfaces ADD_ONS when they hurt the competitor is a
 * renderer nobody should trust with the numbers that do.
 *
 * Not folded into TIER_FEATURES: it appears there as the Core bullet "Premium
 * Support Package", mapped to [], which is where the gap belongs.
 */
export const ADD_ONS = Object.freeze([
  Object.freeze({
    label: "Projul Premium Support Package",
    price: 4500,
    currency: "USD",
    per: "year",
    // Onboarding, training and data import. We sell the last of these as a paid
    // migration (docs/MIGRATION-SERVICE.md); they give it away with the plan.
    keys: Object.freeze([]),
    includedFree: true,
    includedFreeWording: "FREE with annual plan",
    bullets: Object.freeze([
      "Personalized workflow analysis",
      "System customization to fit your company's needs",
      "Customized training plan and resources",
      "Data import for smooth transition from other systems",
      "Support when you need it via phone, email, video chat",
    ]),
    source: "https://projul.com/pricing/",
    checked: "2026-09-09",
  }),
]);

/** Anything a reader of the comparison page must know before quoting it. */
export const NOTES = Object.freeze([
  "The bullet lists are HIGHLIGHTS, not an inventory. Their Core card lists fifteen items and their own feature nav lists thirty-odd, several of which (Zapier, Live Construction Costs, Job Management) appear on no pricing card at any tier. A capability absent from a card is therefore not proven absent from the plan. Word every claim as 'not listed on their pricing page', which is checkable, and never as 'Projul cannot do this' — the first prospect who knows better discredits the whole page, including the parts that are true.",
  "Projul is FLAT ANNUAL, and that is the single most important fact about comparing them. There is no per-seat charge and no monthly option at all — their FAQ says 'we can't currently offer a monthly option' in as many words. Against our per-seat ladder this cuts both ways and the page must say both: a ten-person shop pays them the same as a two-person shop, and a two-person shop pays $4,788 up front before it has sent a quote. Never render our annualised figure beside their annual one without saying that theirs is due as one payment.",
  "'No per-user fees' is true and it is not the same as 'unlimited users'. 'Unlimited Users' is a PRO bullet, at $14,388 — so Core and Core+ have a user ceiling, and their page never says what it is. Their own FAQ confirms the gating exists: 'you can add employees from your account and you will be prompted when you are about to switch plans.' The subcontractor ceiling IS published ('Core plan: Up to 20 subcontractor profiles'), the employee one is not. Any sentence of ours about their flat pricing must survive a prospect discovering this on the demo call, so say it first: flat per plan, with a headcount you find out about when you cross it.",
  "Cheapest tier carrying a full quote → invoice → payment flow is CORE, at $4,788/year: Estimating, eSignatures, and Invoicing & Payment Processing are all on the entry card. Do not build the page on 'their cheap plans don't compare' — on this competitor that framing is simply false, and it is the framing that worked against Jobber and QuoteIQ. The true line is different and stronger: Core is the cheapest plan that quotes and invoices, and it is still four times our entry price for a one-van contractor, with job costing, time tracking, a client portal and change orders another $2,400 above it at Core+.",
  "Job costing, time tracking, client portal, change orders and QuickBooks are all Core+ ($7,188), not Core. A contractor who wants what FieldQuo includes on every plan is looking at Core+ before the comparison starts. That is the honest version of 'the cheaper plan does not compare' for this competitor — it is about ONE step of their ladder, not the bottom of it.",
  "competitors.js records Projul's currency as `owner_asserted` on the grounds that their page never states it, and that finding is now OUT OF DATE. The served HTML carries JSON-LD structured data: `\"offers\":{\"@type\":\"AggregateOffer\",\"priceCurrency\":\"USD\",\"lowPrice\":\"4788\",\"highPrice\":\"14388\"}`. That is the publisher declaring the currency in machine-readable form — weaker than visible copy for a human reading the page, stronger than anyone's inference. Someone should re-grade `currencySourcing` from `owner_asserted` to `publisher` in competitors.js. NOT done here: this file was scoped to features, and rewriting price provenance nobody asked for is how a wrong number ships.",
  "The three stored figures in competitors.js carry `featuresSourcing: \"owner_relayed\"` phrase lists that are lowercased paraphrases of the bullets in this file ('CRM' vs 'CRM & Sales Tools', 'QuickBooks Online' vs 'QuickBooks® Online Integration'). They are not wrong, they are not verbatim, and an exact-phrase mapping keyed on them would match nothing. Prefer THIS file's PUBLISHED_TIERS for any phrase-level work. The amounts, ids, CTA and `theyHaveWeDont` entries over there are unaffected and were confirmed unchanged by this read.",
  "Seven empty mappings are real gaps on our side, not scoring choices: the native mobile app, mobile notifications, Gantt charts, linear timelines, progress billing, purchase orders, daily logs, geolocation/geofencing, QuickBooks Online and Desktop, Spanish, and their free $4,500 onboarding package. Most belong in theyHaveWeDont and four already are. The mobile app is the one that costs us most, because it is on their cheapest tier.",
  "Read from a US connection on 2026-09-09. Projul is registered in Saint George, Utah and prices in USD per their own structured data. Their site offers a Spanish (🇲🇽) switch; the Spanish pricing page was not read here, so do not assume these figures hold on it.",
  "Their page argues one point for us and one against us in the same sentence: 'Projul starts at $4,788/year with no per-user fees and unlimited projects.' The first half is our line, the second half is theirs. An honest renderer never quotes one without the other.",
]);

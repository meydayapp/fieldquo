// lib/sales/intel/capabilities.js
//
// What FieldQuo can actually sell a prospect — the seed behind the
// `FieldQuoCapability` table, which `ProspectOpportunity.capabilityCode` has a
// foreign key to. That FK is what makes the spec's §11 ("never recommend a
// capability FieldQuo does not actually have") a database constraint instead
// of a hope.
//
// ══ This list is DERIVED, not written ══════════════════════════════════════
//
// Every entry below carries `matrixKeys` — keys into lib/marketing/featureMatrix.js
// — and `capabilityMatrix()` refuses to build an entry whose keys are not all
// present there. That file is not marketing copy either: each of its entries
// names the routes and libraries that implement it, and `check:feature-matrix`
// fails the build when a proof path stops existing or stops containing what
// the claim says.
//
// So the chain is: a rep's talking point → a capability row → a marketing
// claim → a named file that still holds a named string. Delete the booking
// route and the build goes red, rather than a rep going on promising online
// booking to a contractor.
//
// The alternative — typing a plausible feature list from the product tour —
// is how a rep ends up promising a mobile app. There is no mobile app. The
// discipline is the same one lib/marketing/featureMatrix.js's own header
// argues for, borrowed wholesale because it already works.
//
// ══ What is NOT here ═══════════════════════════════════════════════════════
//
// See EXCLUDED_CAPABILITIES at the bottom. An absent capability is a decision
// on the record with a reason, because the failure this file exists to prevent
// is silent over-claiming, and silence is what an omission looks like.
//
// ══ Plan tiers: there aren't any ═══════════════════════════════════════════
//
// A brief for this work asked us to "note the tier" for a capability that is
// real but only on a higher plan. There are none. lib/marketing/featureMatrix.js's
// PLAN_DIFFERENCES states the finding outright and `check:feature-matrix`
// asserts it against SEAT_LADDER: Solo, Crew, Shop and Scale differ in how many
// people they seat and what they cost, and in nothing else. Every rung gets the
// receptionist, the website, the AI review, the payouts.
//
// `planNote` therefore says "every plan" for every entry, computed from the
// matrix rather than typed, so the day one rung genuinely gates something this
// list changes with it instead of going quietly stale. What DOES vary is
// metered usage — the receptionist's talk time is prepaid credit, not
// subscription — and that is carried in `usageNote` because a rep saying
// "included" about it would be a false claim about our own price.
import {
  FEATURE_MATRIX,
  matrixEntry,
} from "@/lib/marketing/featureMatrix";

/**
 * Capabilities that a crawler can plausibly observe ABOUT A PROSPECT, and that
 * an opportunity rule is therefore allowed to condition on.
 *
 * ── Why this vocabulary is declared here rather than in the crawler ────────
 *
 * The crawler writes `ProspectCapability` rows; the rules read them. A rule
 * conditioning on a code no detector will ever emit is a rule that can never
 * fire — a dead control with no button, which is the failure class AGENTS.md
 * names. Declaring the contract on the READING side lets the rule validator
 * reject that at seed time; the crawler is then held to producing these codes
 * rather than the two files inventing separate spellings of the same idea.
 *
 * Codes deliberately overlap FIELDQUO capability codes where the same idea is
 * both observable and sellable ("they have no online booking" → "we do online
 * booking"). They are not required to: JOB_COSTING is sellable and unobservable
 * from a website, PUBLISHED_HOURS is observable and not a thing we sell.
 */
export const OBSERVABLE_CAPABILITY_CODES = Object.freeze([
  "WEBSITE",
  "ONLINE_BOOKING",
  "INSTANT_ESTIMATE",
  "ONLINE_PAYMENT",
  "LEAD_CAPTURE_FORM",
  "CLIENT_PORTAL",
  "LIVE_CHAT",
  "PUBLISHED_HOURS",
  "EMAIL_CONTACT",
  "PHONE_CONTACT",
  "ONLINE_REVIEWS",
]);

/**
 * The one thing a `tableStakes` flag decides, and why it is a claim about US.
 *
 * When a prospect is already running a field-service platform, the sales
 * conversation is a DISPLACEMENT, not a gap-filling exercise: telling somebody
 * on Jobber that they need online booking is telling them about a thing they
 * are already paying for, and it ends the call.
 *
 * The obvious implementation is a competitor→features map. We do not have a
 * sourced one — lib/marketing/competitors.js carries exactly one comparable
 * feature (ai_receptionist) at publisher sourcing, and asserting the rest from
 * memory would be an unverified claim about somebody else's product printed in
 * a rep's script.
 *
 * So the flag is inverted to a claim about FieldQuo that we CAN stand behind:
 * is this capability something any field-service platform would be expected to
 * carry? If yes, it is not a displacement argument, whoever the incumbent is.
 * Over-marking is the safe direction — it removes talking points, it never
 * invents one — and a rule that tries to pitch a table-stakes capability at
 * somebody with a competitor installed is refused by
 * `assertDisplacementSafe()`, executed in scripts/check-sales-opportunity.mjs.
 */
const TABLE_STAKES = true;
const DIFFERENTIATOR = false;

/**
 * The matrix.
 *
 * `salesPriority` is a 0–100 ordering, not a score with units: it decides which
 * three of nine recommendations a rep reads out first. Higher is sooner.
 *
 * `talkingPoints` are what a rep says. They are constrained the same way the
 * marketing matrix constrains its own copy — a contractor's words, no internal
 * vocabulary — and a capability whose matrix entry is `partial` MUST carry that
 * entry's own `limits` sentence among them. `capabilityMatrix()` enforces it,
 * because a hedge that is true in featureMatrix.js and missing from a rep's
 * script is the hedge that stops existing.
 */
const CAPABILITIES = [
  // ── Being findable and reachable at all ──────────────────────────────────
  {
    code: "WEBSITE",
    name: "A website of their own",
    description:
      "A real site on their own domain, built from what they already do, that " +
      "they can change themselves.",
    matrixKeys: ["website_builder"],
    salesPriority: 95,
    tableStakes: DIFFERENTIATOR,
    incompatibilities: [],
    talkingPoints: [
      "You get a site on your own domain, not a profile page on somebody else's directory.",
      "It is built from the work you have already done — your services, your prices, your photos.",
      "You can change the words yourself without phoning anybody.",
    ],
  },
  {
    code: "ONLINE_BOOKING",
    name: "Online booking page",
    description:
      "A page where a homeowner picks a slot that is genuinely free, without a " +
      "phone call.",
    matrixKeys: ["booking_page", "client_reschedule"],
    salesPriority: 90,
    tableStakes: TABLE_STAKES,
    incompatibilities: [],
    talkingPoints: [
      "Homeowners book the slot themselves, from the times you are actually free.",
      "They can move their own appointment instead of ringing you at seven in the morning.",
      "It works on a phone in a driveway, which is where most of them are.",
    ],
  },
  {
    code: "BOOKING_DEPOSIT",
    name: "A deposit to hold the slot",
    description: "Take money at the moment of booking so the slot is real.",
    matrixKeys: ["booking_deposit"],
    salesPriority: 55,
    tableStakes: DIFFERENTIATOR,
    // Nothing to hold a deposit against if they cannot book online in the first
    // place. Recommending the deposit to somebody with no booking page is
    // selling the second half of a thing.
    incompatibilities: [],
    requires: ["ONLINE_BOOKING"],
    talkingPoints: [
      "Ask for a deposit when they book, so the slot in your day is paid for.",
      "The money lands in your own account, not ours.",
    ],
  },
  {
    code: "LEAD_CAPTURE_FORM",
    name: "An enquiry form that goes somewhere",
    description:
      "A form for their existing site whose answers land in a worked list, not " +
      "an inbox.",
    matrixKeys: ["lead_form", "leads", "embeds"],
    salesPriority: 80,
    tableStakes: TABLE_STAKES,
    incompatibilities: [],
    talkingPoints: [
      "Drop the form on the site you already have — you do not have to move anything.",
      "What comes back lands in a list you work through, not an inbox you forget.",
      "Every enquiry is scored hot to cold and turns into a quote in one click.",
    ],
  },
  {
    code: "AI_RECEPTIONIST",
    name: "Something answers the phone",
    description:
      "An answering service in the company's own name that books the job and " +
      "drafts the quote from what the caller said.",
    matrixKeys: ["voice_receptionist", "voice_callbacks", "call_to_quote"],
    salesPriority: 92,
    tableStakes: DIFFERENTIATOR,
    incompatibilities: [],
    talkingPoints: [
      "The calls you miss on a ladder get answered, in your company's name.",
      "It books the appointment and writes up the quote from what the caller told it.",
      "It rings back to confirm the day before, so you are not driving to an empty house.",
    ],
  },

  // ── Turning an enquiry into a signed price ───────────────────────────────
  {
    code: "INSTANT_ESTIMATE",
    name: "A price before you have spoken",
    description:
      "A homeowner prices their own job from the contractor's real rates, " +
      "without a site visit.",
    matrixKeys: ["instant_quotes", "self_quote"],
    salesPriority: 88,
    tableStakes: DIFFERENTIATOR,
    incompatibilities: [],
    talkingPoints: [
      "Somebody at eleven at night gets a real number off your own rates instead of a form.",
      "Your rates stay yours — the page never publishes your price list.",
      "You get the enquiry with the job already described.",
    ],
  },
  {
    code: "ONLINE_QUOTE_APPROVAL",
    name: "The client signs from their phone",
    description:
      "Quotes sent by email, opened on a phone, approved and signed without " +
      "printing anything.",
    matrixKeys: ["quote_send", "quote_pdf", "online_approval", "priced_options"],
    salesPriority: 85,
    tableStakes: TABLE_STAKES,
    incompatibilities: [],
    talkingPoints: [
      "They open it on a phone, pick the option they want, and sign it there.",
      "You can send one job at three prices and let them choose.",
      "The PDF carries your colours and your logo, not ours.",
    ],
  },
  {
    code: "AI_QUOTE_REVIEW",
    name: "A second read of the quote",
    description:
      "The quote is checked for what was left out before it goes, and add-ons " +
      "worth offering are suggested.",
    matrixKeys: ["ai_quote_review", "add_on_upsell"],
    salesPriority: 70,
    tableStakes: DIFFERENTIATOR,
    incompatibilities: [],
    talkingPoints: [
      "It reads the quote before you send it and says what you have left out.",
      "It suggests the add-ons worth offering on this particular job.",
    ],
  },
  {
    code: "AUTOMATIC_FOLLOW_UPS",
    name: "The quote chases itself",
    description: "Unanswered quotes are followed up without anyone remembering to.",
    matrixKeys: ["follow_ups"],
    salesPriority: 72,
    tableStakes: DIFFERENTIATOR,
    incompatibilities: [],
    talkingPoints: [
      "A quote nobody answered gets chased without you remembering to do it.",
      "It stops the moment they reply, so nobody gets nagged after saying yes.",
    ],
  },
  {
    code: "AERIAL_MEASURE",
    name: "Measuring from the sky",
    description: "Roof measurements taken from aerial imagery instead of a ladder.",
    matrixKeys: ["aerial_measure"],
    salesPriority: 45,
    tableStakes: DIFFERENTIATOR,
    incompatibilities: [],
    talkingPoints: [
      "Measure a roof from the address instead of driving out with a ladder.",
    ],
  },
  {
    code: "KITCHEN_DESIGNER",
    name: "Kitchen and cabinet designer",
    description: "Lay out a kitchen and price the cabinets from the layout.",
    matrixKeys: ["kitchen_designer"],
    salesPriority: 40,
    tableStakes: DIFFERENTIATOR,
    incompatibilities: [],
    talkingPoints: [
      "Draw the kitchen, and the cabinet prices come off your own price book.",
    ],
  },

  // ── Doing the work ───────────────────────────────────────────────────────
  {
    code: "SCHEDULING_DISPATCH",
    name: "Scheduling and dispatch",
    description:
      "Who is going where, this week and next, including work that repeats.",
    matrixKeys: ["scheduling", "jobs", "crew_shifts", "recurring_jobs"],
    salesPriority: 68,
    tableStakes: TABLE_STAKES,
    incompatibilities: [],
    talkingPoints: [
      "One board for who is where, this week and next.",
      "Repeat work schedules itself instead of being retyped every season.",
    ],
  },
  {
    code: "APPOINTMENT_REMINDERS",
    name: "Reminders before the visit",
    description: "The client is reminded before you drive out.",
    matrixKeys: ["appointment_reminders"],
    salesPriority: 60,
    tableStakes: TABLE_STAKES,
    incompatibilities: [],
    talkingPoints: [
      "The client gets reminded before you drive out to an empty house.",
    ],
  },
  {
    code: "JOB_COSTING",
    name: "What the job actually cost",
    description:
      "Labour, materials and expenses against the price, per job, after the fact.",
    matrixKeys: ["job_costing", "materials", "expenses", "time_clock", "timesheets"],
    salesPriority: 75,
    tableStakes: DIFFERENTIATOR,
    incompatibilities: [],
    talkingPoints: [
      "You find out what a job cost while you can still do something about it.",
      "Hours come off the clock-in, not off a memory at the end of the month.",
    ],
  },
  {
    code: "CREW_MESSAGING",
    name: "The crew just texts",
    description:
      "Crew send photos and updates by text; they land filed against the right " +
      "job.",
    matrixKeys: ["crew_inbox", "job_photos"],
    salesPriority: 58,
    tableStakes: DIFFERENTIATOR,
    incompatibilities: [],
    talkingPoints: [
      "Your crew text a photo the way they already do, and it files itself against the job.",
      "Nobody has to install anything or remember a password.",
    ],
  },

  // ── Getting paid ─────────────────────────────────────────────────────────
  {
    code: "INVOICING",
    name: "Invoices that mirror the quote",
    description:
      "An invoice built from the quote that was approved, with changes tracked.",
    matrixKeys: ["invoices", "invoice_send", "invoice_changes"],
    salesPriority: 78,
    tableStakes: TABLE_STAKES,
    incompatibilities: [],
    talkingPoints: [
      "The invoice is the quote they approved, so nobody argues about the number.",
      "When it changes, the change is on the record.",
    ],
  },
  {
    code: "ONLINE_PAYMENT",
    name: "Get paid by card",
    description:
      "The client pays from the invoice; the money goes to the contractor's own " +
      "payout account.",
    matrixKeys: ["card_payments", "stripe_connect"],
    salesPriority: 87,
    tableStakes: TABLE_STAKES,
    incompatibilities: [],
    talkingPoints: [
      "They pay from the invoice on their phone instead of posting a cheque.",
      "It is your own payout account — the money never sits with us.",
    ],
  },
  {
    code: "CLIENT_PORTAL",
    name: "A place the client can look",
    description:
      "The client's own page: their quotes, their invoices, what is outstanding.",
    matrixKeys: ["client_portal"],
    salesPriority: 50,
    tableStakes: TABLE_STAKES,
    incompatibilities: [],
    talkingPoints: [
      "They can find their own paperwork instead of phoning you for a copy.",
    ],
  },
  {
    code: "MAINTENANCE_PLANS",
    name: "Maintenance plans",
    description: "Recurring work sold as a plan, billed on its own schedule.",
    matrixKeys: ["service_plans"],
    salesPriority: 42,
    tableStakes: DIFFERENTIATOR,
    incompatibilities: [],
    talkingPoints: [
      "Sell the seasonal work as a plan instead of chasing it every year.",
    ],
  },

  // ── Running the business ─────────────────────────────────────────────────
  {
    code: "WHITE_LABEL_DOCUMENTS",
    name: "Everything carries their name",
    description:
      "Quote, invoice, booking page, website and email all in the company's own " +
      "brand, with no trace of the software.",
    matrixKeys: [
      "white_label",
      "document_layouts",
      "own_email_domain",
      "contract_terms",
      "quote_email_wording",
    ],
    salesPriority: 82,
    tableStakes: DIFFERENTIATOR,
    incompatibilities: [],
    talkingPoints: [
      "The homeowner never sees our name — the quote, the invoice and the email are yours.",
      "The email comes from your own address, not a shared one.",
      "Your terms print on every document without anyone pasting them in.",
    ],
  },
  {
    code: "PRICE_BOOK",
    name: "Their own price book",
    description:
      "Their rates and material costs in one place, with the break-even price " +
      "behind them.",
    matrixKeys: ["price_book", "material_costs", "break_even"],
    salesPriority: 65,
    tableStakes: TABLE_STAKES,
    incompatibilities: [],
    talkingPoints: [
      "Your rates live in one place, so two estimators quote the same job the same way.",
      "It tells you the price below which you are working for nothing.",
    ],
  },
  {
    code: "BUSINESS_DASHBOARD",
    name: "The numbers, monthly",
    description:
      "Win rate, margin, what is owed, and a written monthly summary.",
    matrixKeys: ["dashboard", "goals", "monthly_digest", "benchmark"],
    salesPriority: 48,
    tableStakes: TABLE_STAKES,
    incompatibilities: [],
    talkingPoints: [
      "You get a written monthly summary instead of a screen of charts nobody opens.",
      "It says how your prices compare with what you have quoted before.",
    ],
  },
  {
    code: "FIELDQUO_AI",
    name: "Ask it about your own business",
    description:
      "An assistant that answers about the company's own quotes, jobs and money.",
    matrixKeys: ["ai_copilot"],
    salesPriority: 44,
    tableStakes: DIFFERENTIATOR,
    incompatibilities: [],
    talkingPoints: [
      "Ask it what you quoted the Johnsons last spring and it answers from your own records.",
      "It only ever sees your business — never anybody else's.",
    ],
  },
  {
    code: "BILINGUAL_DOCUMENTS",
    name: "English and French",
    description:
      "Documents and client emails in the language the client actually reads.",
    matrixKeys: ["languages"],
    salesPriority: 38,
    tableStakes: DIFFERENTIATOR,
    incompatibilities: [],
    talkingPoints: [
      "Send the quote in French to the client who reads French, and English to the one who does not.",
      "A signed document keeps the language it was written in — nothing is re-translated later.",
    ],
  },
  {
    code: "EMAIL_MARKETING",
    name: "Email their past clients",
    description: "Campaigns to the client list they already have.",
    matrixKeys: ["email_campaigns", "review_requests", "testimonials"],
    salesPriority: 52,
    tableStakes: TABLE_STAKES,
    incompatibilities: [],
    talkingPoints: [
      "Mail the clients you already have instead of buying strangers.",
      "Ask for the review at the moment the job finished well.",
    ],
  },
  {
    code: "BIO_LINK",
    name: "One link for their profiles",
    description:
      "A single link for a Facebook or Instagram profile that leads to booking " +
      "and quoting.",
    matrixKeys: ["bio_link"],
    salesPriority: 30,
    tableStakes: DIFFERENTIATOR,
    // A contractor with a real site does not need a link-in-bio page; it is the
    // thing you use INSTEAD of one. Recommending both makes the rep look like
    // they have not looked at the business.
    incompatibilities: ["WEBSITE"],
    talkingPoints: [
      "One link on your Facebook page that leads to booking, quoting and your photos.",
    ],
  },
  {
    code: "LEAD_FUNNELS",
    name: "Lead funnels",
    description: "A short question flow that ends in an enquiry or a booking.",
    matrixKeys: ["funnels"],
    salesPriority: 35,
    tableStakes: DIFFERENTIATOR,
    incompatibilities: [],
    talkingPoints: [
      "A few questions instead of a contact form, so you know what the job is before you ring back.",
    ],
  },
];

/**
 * What is deliberately NOT sellable, and why.
 *
 * Same job as lib/marketing/featureMatrix.js's MATRIX_EXCLUSIONS, one layer
 * over: that file stops a public page over-claiming, this stops a rep doing it
 * on a call, which is worse because there is no page to correct afterwards.
 *
 * A code appearing here may never appear above — asserted in
 * scripts/check-sales-opportunity.mjs, so the two lists cannot both grow to
 * contain the same thing.
 */
export const EXCLUDED_CAPABILITIES = Object.freeze([
  Object.freeze({
    code: "LIVE_CHAT",
    reason:
      "FieldQuo has no chat widget. Nothing in lib/ or app/ implements one. " +
      "LIVE_CHAT stays in OBSERVABLE_CAPABILITY_CODES because a chat widget on " +
      "a PROSPECT's site is a real, detectable signal about how they answer " +
      "enquiries — it is just not a thing we can sell them.",
  }),
  Object.freeze({
    code: "MOBILE_APP",
    reason:
      "There is no application to install, on any store. featureMatrix.js's " +
      "own exclusion says the only claim that may ever be made is that the " +
      "back office works in a phone browser. A rep saying 'app' on a call is " +
      "the same false claim with no page to correct it.",
  }),
  Object.freeze({
    code: "GOOGLE_REVIEW_IMPORT",
    reason:
      "Blocked on Google's own approval, not on our code. Review REQUESTS are " +
      "sellable (EMAIL_MARKETING) — importing what Google already holds is not, " +
      "and must not be implied by the review-request talking point.",
  }),
  Object.freeze({
    code: "SOCIAL_PUBLISHING",
    reason:
      "There is no Meta app connection: lib/social/metaConnection.js always " +
      "reports not connected, and Meta's own App Review is unstarted. See " +
      "docs/SOCIAL-PUBLISHING.md.",
  }),
  Object.freeze({
    code: "MARKETING_DESIGNER",
    reason:
      "The canvas editor is built and no /app page mounts it, so a contractor " +
      "cannot open the screen. featureMatrix.js excludes it for exactly this " +
      "reason.",
  }),
  Object.freeze({
    code: "CUSTOM_FIELDS",
    reason:
      "The settings screen saves field definitions and nothing reads the " +
      "values. Written and never read — the first recurring failure class in " +
      "AGENTS.md.",
  }),
  Object.freeze({
    code: "WARM_TRANSFER",
    reason:
      "The receptionist cannot hand a caller over mid-call. A column is saved " +
      "and nothing in lib/voice reads it, so the AI_RECEPTIONIST talking " +
      "points above must not imply one.",
  }),
  Object.freeze({
    code: "MARKETPLACE_LEAD_INBOX",
    reason:
      "One inbox for Google, Thumbtack and Angi leads is not built. It needs a " +
      "signed-in account with each marketplace before any of it can be tested.",
  }),
  Object.freeze({
    code: "PAYROLL",
    reason:
      "Real but partial (featureMatrix.js `payroll`), and it is not a thing " +
      "observable about a prospect from the outside, so no rule could cite " +
      "evidence for it. Excluded from the sellable matrix rather than seeded " +
      "with no rule that can ever reach it — see the note on unreachable " +
      "capabilities in opportunity.js.",
  }),
  Object.freeze({
    code: "CONTRACTOR_PAYOUTS",
    reason: "Same as PAYROLL: real, partial, and not externally observable.",
  }),
  Object.freeze({
    code: "CLIENT_FINANCING",
    reason:
      "featureMatrix.js marks `financing` partial. It is a genuine capability " +
      "and deliberately left out of a cold-call script: the limits are about " +
      "who the lender is, and a rep summarising them on a phone call is how " +
      "a financing promise gets made that FieldQuo cannot keep. Sell it in the " +
      "room, not from this list.",
  }),
]);

const EXCLUDED_CODES = new Set(EXCLUDED_CAPABILITIES.map((e) => e.code));

/** Is this code one we have explicitly ruled out? */
export function isExcludedCapability(code) {
  return EXCLUDED_CODES.has(code);
}

/**
 * Build the matrix, refusing anything that cannot be traced to a shipped claim.
 *
 * Throws rather than dropping. A capability that silently vanished from a rep's
 * list because somebody renamed a marketing key is a lost sale nobody would
 * ever look for; a build that stops is a five-minute fix.
 *
 * @returns {Array<{code,name,description,salesPriority,active,requiredEvidence,incompatibilities,recommendedTalkingPoints}>}
 *          rows shaped for `FieldQuoCapability`, in descending sales priority.
 */
export function capabilityMatrix() {
  const seen = new Set();
  const rows = CAPABILITIES.map((c) => {
    if (seen.has(c.code)) throw new Error(`capabilityMatrix: duplicate code ${c.code}`);
    seen.add(c.code);
    if (EXCLUDED_CODES.has(c.code)) {
      throw new Error(
        `capabilityMatrix: ${c.code} is both sellable and in EXCLUDED_CAPABILITIES`,
      );
    }

    const entries = c.matrixKeys.map((key) => {
      const entry = matrixEntry(key);
      if (!entry) {
        throw new Error(
          `capabilityMatrix: ${c.code} cites featureMatrix key "${key}", which does not exist. ` +
            "Either the marketing entry was renamed or this capability was invented.",
        );
      }
      return entry;
    });

    // A partial marketing claim carries its own `limits` sentence and the rep's
    // script has to carry it too. featureMatrix.js's check refuses a partial
    // entry with no limits, so this cannot silently find nothing to append.
    const caveats = entries
      .filter((e) => e.readiness === "partial")
      .map((e) => `${e.name}: ${e.limits}`);

    // Every plan, computed. See the header: PLAN_DIFFERENCES says nothing in
    // the matrix is withheld from a cheaper plan, and check:feature-matrix
    // asserts it. The day one entry becomes varies_by_plan this sentence
    // changes on its own instead of having to be remembered.
    const varying = entries.filter((e) => e.availability !== "every_plan");
    const planNote =
      varying.length === 0
        ? "Included on every plan."
        : `Depends on the plan: ${varying.map((e) => e.name).join(", ")}.`;

    // Withholdable by a platform admin — not a plan gate, a kill switch (see
    // lib/features/registry.js). A rep does not need to say it; a superadmin
    // reading the matrix screen does, because a capability withdrawn globally
    // should not be top of anyone's script.
    const featureKeys = [...new Set(entries.map((e) => e.featureKey).filter(Boolean))];

    return {
      code: c.code,
      name: c.name,
      description: c.description,
      active: true,
      salesPriority: c.salesPriority,

      // `requiredEvidence` is the schema's own column: "what must be observed
      // before this may be recommended". It is stored as the CONTRACT rather
      // than as a rule — the rules in OpportunityRule decide when a gap becomes
      // a recommendation; this records that a recommendation may never be
      // produced without a citation, which lib/sales/intel/opportunity.js
      // enforces structurally.
      requiredEvidence: {
        minEvidence: 1,
        observableAs: OBSERVABLE_CAPABILITY_CODES.includes(c.code) ? c.code : null,
        requires: c.requires || [],
      },
      incompatibilities: [...c.incompatibilities],

      recommendedTalkingPoints: {
        // The authored sentences only. The caveats are NOT folded in here:
        // `points` is the editable half (see mergeTalkingPoints) and a caveat
        // mixed into it would become deletable from the capability screen,
        // which is the one thing it must not be. `repScript()` below is what
        // composes the two for anything a rep actually reads.
        points: [...c.talkingPoints],
        caveats,
        planNote,
        // Stated separately because "included" is false about it and saying
        // so on a call is a false claim about our own price — the exact
        // reasoning behind FEATURE_INCLUDED_USAGE_EXTRA in
        // lib/marketing/competitors.js.
        usageNote: featureKeys.includes("voice_receptionist")
          ? "The receptionist is on every plan; the talk time is prepaid credit, not part of the subscription."
          : null,
        tableStakes: c.tableStakes,
        matrixKeys: [...c.matrixKeys],
        featureKeys,
      },
    };
  });

  return rows.sort(
    (a, b) => b.salesPriority - a.salesPriority || a.code.localeCompare(b.code),
  );
}

/**
 * Everything a rep says about one capability, in the order they say it.
 *
 * ── Why this is a function and not just `points` ───────────────────────────
 *
 * The editable sentences and the mandatory caveats are stored separately, on
 * purpose: one is a superadmin's to write and the other is derived from a
 * `partial` marketing claim and must not be deletable. But a rep does not read
 * two lists — they read a script — and if composing it is left to each caller,
 * the caller that forgets the caveats is the one that ships. So there is one
 * function, and the caveats come last because they are the qualification, not
 * the pitch.
 *
 * Takes a stored row or a seed row; both carry the same `recommendedTalkingPoints`.
 */
export function repScript(capability) {
  const t = capability?.recommendedTalkingPoints || {};
  return [
    ...(Array.isArray(t.points) ? t.points : []),
    ...(Array.isArray(t.caveats) ? t.caveats : []),
    ...(t.usageNote ? [t.usageNote] : []),
  ];
}

/**
 * A re-seed: refresh the derived half, keep what a superadmin wrote.
 *
 * ── Why the split is not "additive" or "overwrite" ─────────────────────────
 *
 * `caveats`, `planNote`, `usageNote` and `tableStakes` come from
 * lib/marketing/featureMatrix.js and MUST refresh — a claim that gains a limit
 * has to gain it in the rep's script too, and an additive seed that left the
 * old sentence standing is precisely how a hedge stops existing.
 *
 * `points` — the sentences a rep says — must NOT. They are what the capability
 * screen edits, and a seed that reset them would make that screen a control
 * that appears to work and doesn't, on whatever schedule somebody happens to
 * re-run the seed.
 *
 * Pure and here rather than in db.js so the check script can execute it
 * against a row a superadmin has already edited, with no database.
 */
export function mergeTalkingPoints(existing, seeded) {
  const prior =
    existing?.recommendedTalkingPoints &&
    typeof existing.recommendedTalkingPoints === "object" &&
    !Array.isArray(existing.recommendedTalkingPoints)
      ? existing.recommendedTalkingPoints
      : null;

  const authored = Array.isArray(prior?.points)
    ? prior.points.filter((p) => typeof p === "string" && p.trim())
    : [];

  return {
    ...seeded.recommendedTalkingPoints,
    points: authored.length ? authored : seeded.recommendedTalkingPoints.points,
  };
}

/** Codes only, in the same order. Convenient for a validator. */
export function capabilityCodes() {
  return capabilityMatrix().map((c) => c.code);
}

/**
 * Which capabilities may be pitched to a prospect who already runs a
 * competitor's platform?
 *
 * The whole displacement rule, in one function so there is one answer. See
 * TABLE_STAKES above for why the question is asked of our own list rather than
 * of a competitor feature map we do not have a source for.
 */
export function displacementCapabilities(matrix = capabilityMatrix()) {
  return matrix.filter((c) => c.recommendedTalkingPoints?.tableStakes === false);
}

/**
 * Does this capability survive a competitor being installed?
 *
 * Separate from the filter above so a rule validator can ask about one code
 * without materialising the list, and so the check script can assert the
 * property per rule rather than per set.
 */
export function isDisplacementSafe(code, matrix = capabilityMatrix()) {
  const row = matrix.find((c) => c.code === code);
  return row ? row.recommendedTalkingPoints.tableStakes === false : false;
}

/**
 * Every featureMatrix key this file leans on, for the check script.
 *
 * Exported rather than recomputed there: a check that rebuilds the list it is
 * checking proves only that it can run the same code twice.
 */
export function citedMatrixKeys() {
  return [...new Set(CAPABILITIES.flatMap((c) => c.matrixKeys))].sort();
}

/** The whole marketing matrix, so a caller can diff against what we cite. */
export function allMatrixKeys() {
  return FEATURE_MATRIX.map((e) => e.key);
}

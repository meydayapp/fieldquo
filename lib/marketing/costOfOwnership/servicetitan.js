// lib/marketing/costOfOwnership/servicetitan.js
//
// What contractors REPORT it costs to own ServiceTitan for a year — the
// subscription, the implementation fee, the training, the ramp, the add-ons
// and the exit. Every figure here is third-hand. None of it is ServiceTitan's
// price list, because ServiceTitan does not have a public one.
//
// ══ Why this is a separate file from lib/marketing/competitors.js ══════════
//
// competitors.js already carries a ServiceTitan entry, and it already has a
// `reportedCosts` array with per-tier bands in it. The obvious move was to add
// nine more fields to that entry and be done. It was rejected, twice over.
//
// FIRST, because of what competitors.js is FOR. Its load-bearing invariant —
// asserted in check-competitors.mjs — is that every figure's source host is
// the competitor's own domain. That is what stops a review site's stale number
// becoming FieldQuo's published claim about somebody else's business. The
// figures below come from a video summary and contractor forum threads. They
// would fail that assertion, and they should. `reportedCosts` is the narrow,
// gated exception carved for per-tier bands; widening it to hold onboarding
// months, hardware upgrades and cancellation penalties turns an exception into
// a second front door.
//
// SECOND, and this is the real reason: a table that blends the two tiers is
// the dishonest version of a true argument. "Housecall Pro Basic is $59/mo"
// was read off Housecall Pro's own pricing page — a visitor can open it in
// another tab and check us in four seconds. "ServiceTitan implementation runs
// $15,000–$30,000" came from contractors talking to each other. Both may be
// true. They are not the same KIND of true, and the moment they share a table
// with one visual weight, the weaker one borrows the stronger one's
// credibility. The strongest, safest claim FieldQuo makes about ServiceTitan
// is the one in competitors.js's `weHaveTheyDont`: they publish no price at
// all, three tiers, three "Request Pricing" buttons, checkable by anybody in
// one click. Everything in THIS file is the softer, more useful, less
// defensible half — and it lives behind its own import so a renderer has to
// reach for it deliberately and label it as what it is.
//
// So: the module boundary IS the disclosure. /compare/fieldquo-vs-servicetitan
// may show both, in two visually distinct blocks, with this one labelled
// "reported by contractors, not published by ServiceTitan". It may never merge
// them into one column of numbers.
//
// ══ What "reported" is protecting against here ═════════════════════════════
//
// Every money band is a `Reported` from competitors.js, which is a class and
// not a `{low, high}` pair on purpose: the endpoints are private, `valueOf`
// throws, and the only way to render one is `String(band)`, which emits the
// whole band with its label attached. That is what stops `$245 per technician`
// and `(245+398)/2` — the two ways a range becomes a false price. Read them
// with String(x) or JSON.stringify(x); there is no `.low`.
//
// Non-money facts (months, percentages, counts, sentences) are plain strings.
// Reported's toString prefixes "$", so a month count routed through it renders
// "$2–$8 months", which is how a careful type produces a careless output. The
// existing `minimumTechnicians` band in competitors.js has exactly that bug;
// it is not copied here.
//
// ══ Nothing in here is estimated, averaged or rounded ══════════════════════
//
// The owner supplied these figures on 2026-09-09 and they are recorded as
// given. One thing had to be worked out rather than read off: his two yearly
// examples are HIGHER than his own per-technician band multiplied by twelve
// months, at both ends and at both headcounts. The gap is the implementation
// fee, and the arithmetic showing that is written out in full in
// `implementationBandFor` — including the residuals, so a reader can check the
// reconstruction instead of trusting it.
//
// That reconstruction is documented inside the function that uses it and is
// deliberately NOT recorded as a field on the dataset. AGENTS.md failure class
// 5 — absence of a statement is not a statement — has a sibling here: a figure
// nobody supplied must not be derived and then presented at the same weight as
// one that was.

import {
  Reported,
  SOURCED_USER_REPORTS,
  UNVERIFIED,
  CURRENCY_NOT_STATED,
} from "@/lib/marketing/competitors";

/**
 * Freezes structure without touching the `Reported` instances inside it.
 *
 * Mirrors competitors.js's private helper rather than exporting that one,
 * because reaching into another module for a four-line utility couples this
 * file to its internals for no benefit. The `!Object.isFrozen` guard is what
 * makes it safe here: `Reported` freezes itself in its constructor, so
 * recursion stops at the boundary and never walks a band.
 */
function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

// ── The raw endpoints, named once ──────────────────────────────────────────
//
// firstYearTotal has to do arithmetic, and `Reported` refuses to be a number —
// which is the point of it. So the endpoints exist here as plain constants and
// are wrapped for display. That is not a loophole: the wrapper stops a
// RENDERER inventing a midpoint, and there is exactly one function in this
// file allowed to compute with the raw values, directly below them, where a
// reviewer reads both at once.

/** Reported per-technician monthly rate. Not a rate card — a range of quotes. */
const PER_TECHNICIAN_LOW = 245;
const PER_TECHNICIAN_HIGH = 398;

/** Reported approximate floor on total monthly spend, whatever the headcount. */
const MINIMUM_MONTHLY = 1500;

/** Implementation tiers, reported as three named bands. */
const IMPLEMENTATION_BASIC = Object.freeze({ low: 5000, high: 15000 });
const IMPLEMENTATION_STANDARD = Object.freeze({ low: 15000, high: 30000 });
const IMPLEMENTATION_ENTERPRISE = Object.freeze({ low: 30000, high: 50000 });

/**
 * A ceiling on the technician count firstYearTotal will do arithmetic on.
 *
 * Not a claim about ServiceTitan's largest customer. It exists so that
 * `firstYearTotal({ technicians: 1e308 })` returns a finite number with a note
 * saying it was clamped, instead of `Infinity` rendering as "$Infinity" on a
 * public marketing page. Ten thousand technicians is far past any contractor
 * this comparison addresses, so the clamp cannot bite a real reader.
 */
const MAX_TECHNICIANS = 10000;

// ══ The reported dataset ═══════════════════════════════════════════════════

export const SERVICETITAN_COST_OF_OWNERSHIP = deepFreeze({
  competitorId: "servicetitan",
  name: "ServiceTitan",

  // Repeated on the object itself, not just in SERVICETITAN_SOURCING, because
  // a renderer that destructures one field of this must still be able to reach
  // the tier without a second import. Cheap redundancy; the alternative is a
  // component that shows a number with no provenance because the provenance
  // was one module away.
  sourcing: SOURCED_USER_REPORTS,
  verification: UNVERIFIED,
  checked: "2026-09-09",

  /** Reported per-technician, per-month subscription. */
  perTechnician: new Reported({
    low: PER_TECHNICIAN_LOW,
    high: PER_TECHNICIAN_HIGH,
    unit: "per technician per month",
    label: "Contractors report paying",
  }),

  // A single figure, so it is a string and not a Reported — the constructor
  // throws on low >= high, and forcing a lone number into a band by inventing
  // a second endpoint is the exact failure this whole module is built against.
  minimumMonthly:
    "a reported minimum spend of approximately $1,500 per month, whatever the technician count",

  /**
   * Two worked yearly figures the owner supplied, at ten and twenty
   * technicians.
   *
   * These are TOTALS, not subscription-only. That is not stated in the source
   * and is not an assumption — it is arithmetic: ten technicians at the
   * reported $245–$398 is $29,400–$47,760 of subscription in a year, and the
   * reported yearly figure starts at $35,000. The gap is the implementation
   * fee. See firstYearTotal, which reconstructs both examples to within the
   * owner's own rounding and records the residual.
   */
  yearlyExamples: [
    {
      technicians: 10,
      band: new Reported({
        low: 35000,
        high: 78000,
        unit: "per year",
        label: "Ten-technician shops report a first year of",
      }),
      note:
        "Subscription alone at the reported per-technician band is $29,400–$47,760. This figure is higher at both ends, which is what identifies it as a total rather than a subscription.",
    },
    {
      technicians: 20,
      band: new Reported({
        low: 64000,
        high: 145000,
        unit: "per year",
        label: "Twenty-technician shops report a first year of",
      }),
      note:
        "Subscription alone at the reported per-technician band is $58,800–$95,520. The remaining $5,200–$49,480 is consistent with the reported implementation tiers, from the bottom of Basic to the top of Enterprise.",
    },
  ],

  /**
   * Implementation, reported as three tiers.
   *
   * No source names which tier a given headcount lands in. The mapping
   * firstYearTotal uses is reconstructed from the two yearly examples above
   * and is documented there as a reconstruction, not recorded here as a fact,
   * because a size-to-tier table nobody supplied would read as one.
   */
  implementationTiers: [
    {
      tier: "Basic",
      band: new Reported({
        low: IMPLEMENTATION_BASIC.low,
        high: IMPLEMENTATION_BASIC.high,
        unit: "one-time",
        label: "an implementation fee reported at",
      }),
    },
    {
      tier: "Standard",
      band: new Reported({
        low: IMPLEMENTATION_STANDARD.low,
        high: IMPLEMENTATION_STANDARD.high,
        unit: "one-time",
        label: "an implementation fee reported at",
      }),
    },
    {
      tier: "Enterprise",
      band: new Reported({
        low: IMPLEMENTATION_ENTERPRISE.low,
        high: IMPLEMENTATION_ENTERPRISE.high,
        unit: "one-time",
        label: "an implementation fee reported at",
      }),
    },
  ],

  /**
   * Time, not money — and the fairest thing on the page.
   *
   * Months are strings. Routed through `Reported` they would render with
   * dollar signs, and a page reading "$2–$8 months" is worse than no figure at
   * all. This is also the comparison FieldQuo wins without needing any of the
   * dollar bands to be right: a contractor signs up at /signup and starts.
   */
  rampMonths: {
    onboarding:
      "2–8 months of onboarding before teams are reported to be fully operational",
    productivityLoss:
      "a reported 3–6 month ramp-up during which the crew is less productive than it was on the old system",
  },

  /** Paid training, reported separately from the implementation fee. */
  trainingCost: new Reported({
    low: 2000,
    high: 5000,
    unit: "one-time",
    label: "paid training reported at",
  }),

  /**
   * Costs that appear in no monthly comparison, ours included.
   *
   * Two of these carry no figure, and that is deliberate rather than an
   * incomplete entry: nobody supplied a dollar amount for data cleanup or for
   * hardware, and putting a plausible one here would be exactly the invention
   * this file's header rules out. `figure: null` says "reported as a cost, no
   * amount established", which is a different statement from "free" and from
   * "we never asked".
   */
  hiddenCosts: [
    {
      id: "servicetitan.toc.training",
      statement: "Paid training, charged on top of implementation",
      figure: "reported at $2,000–$5,000",
      whyItMatters:
        "It is billed as a separate line, so a per-technician quote from a sales call does not contain it.",
    },
    {
      id: "servicetitan.toc.productivity",
      statement: "Lost productivity through a 3–6 month ramp-up",
      figure: null,
      whyItMatters:
        "The largest cost on this list for most shops and the only one that never appears on an invoice. No amount is reported and none is invented here.",
    },
    {
      id: "servicetitan.toc.data_cleanup",
      statement: "Data cleanup and migration before the system is usable",
      figure: null,
      whyItMatters:
        "Reported as a cost, with no amount attached. FieldQuo charges for migration too — see docs/MIGRATION-SERVICE.md — so this is a row where the honest comparison is 'both do', not 'they do'.",
    },
    {
      id: "servicetitan.toc.hardware",
      statement: "Hardware upgrades for technicians",
      figure: null,
      whyItMatters:
        "A per-head capital cost that scales with the same number the subscription scales with, paid to somebody else and therefore invisible in any software comparison.",
    },
  ],

  /**
   * Add-on modules, and the one percentage in this file.
   *
   * The uplift is a string. A percentage is not money, and `Reported` would
   * render it "$30–$50 %". It is also deliberately kept as a percentage OF the
   * subscription rather than multiplied out: 30–50% of a band that is itself
   * $245–$398 wide compounds two uncertainties into a figure that would look
   * more precise than either input. competitors.js records the same term with
   * no percentage at all, for the same reason; this file carries the number
   * because the owner supplied it, and carries it unmultiplied.
   */
  addOnModules: {
    modules: [
      "Marketing Pro",
      "Phones Pro",
      "Pricebook Pro",
      "Dispatch Pro",
      "Fleet Pro",
      "Sales Pro",
    ],
    upliftWhenSeveralAdded:
      "adding several is reported to raise the monthly cost by 30–50%",
    whyItMatters:
      "It means a per-technician figure quoted on a sales call is a floor, not a total. firstYearTotal deliberately does NOT apply this uplift — see its note.",
  },

  /**
   * Contract structure, which a reader can test in one sales call.
   *
   * No numbers except the term length, which is a duration rather than a
   * price. These are the most checkable statements in the file and the least
   * quotable, which is the opposite of the dollar bands and the reason they
   * are here at all.
   */
  contractTerms: [
    {
      id: "servicetitan.term.minimum_term",
      statement: "Minimum terms are reported at 12–36 months",
      whyItMatters:
        "It sets how long a wrong decision lasts. FieldQuo's ladder bills monthly by default and treats annual as an optional discount.",
    },
    {
      id: "servicetitan.term.auto_renewal",
      statement: "Contracts are reported to auto-renew unless cancelled in writing",
      whyItMatters:
        "The default is another full term. Nothing has to be signed for that to happen — which is the point of an auto-renewal and the reason the notice window below matters.",
    },
    {
      id: "servicetitan.term.early_termination",
      statement:
        "Early termination is reported to make the remaining contract balance due",
      whyItMatters:
        "Leaving in month four of a thirty-six month term does not stop the bill; it accelerates it.",
    },
    {
      id: "servicetitan.term.notice_window",
      statement: "Cancelling is reported to require 30 days' written notice",
      whyItMatters:
        "A window that has to be hit. Missing it interacts with auto-renewal, and the two terms together are how a shop that decided to leave stays another year.",
    },
    {
      id: "servicetitan.term.data_export",
      statement: "Data export windows are reported to be limited",
      whyItMatters:
        "The cost of leaving is not only the penalty. A contractor's job history, clients and price book are theirs, and a narrow export window is a switching cost dressed as an operational detail.",
    },
    {
      id: "servicetitan.term.negotiated",
      statement:
        "Pricing is reported to be negotiated on a sales call, with revenue and team size affecting the quote",
      whyItMatters:
        "It is why every band in this file is wide, and why two similar shops report paying very different amounts. It is also the honest answer to 'why can't you just tell me what it costs' — nobody can, including them, until the call.",
    },
  ],

  /**
   * The exit cost.
   *
   * Reported as "$20,000–$50,000+". The band closes at $50,000 because
   * `Reported` renders a closed range and there is no honest way to draw a "+"
   * inside one. The open top is recorded beside it rather than dropped — the
   * same treatment competitors.js gave the "$500+" reading it superseded, and
   * for the same reason: the open end is worth remembering the day somebody
   * reports paying more.
   */
  cancellationPenalty: {
    band: new Reported({
      low: 20000,
      high: 50000,
      unit: "one-time",
      label: "cancellation penalties reported at",
    }),
    openEnded: true,
    note:
      'Reported as "$20,000–$50,000+". The top is not a ceiling anybody stated; it is the largest figure anybody reported.',
  },
});

// ══ First-year arithmetic ══════════════════════════════════════════════════

/**
 * Which implementation band applies at a given technician count.
 *
 * ── This mapping is a RECONSTRUCTION, and here is the working ──────────────
 *
 * No source says "ten technicians gets you the Standard tier". What we have is
 * three implementation bands and two worked yearly totals, and the totals pin
 * the mapping down almost exactly:
 *
 *   10 techs  subscription  $29,400 – $47,760   (245 and 398, x10, x12)
 *             reported total $35,000 – $78,000
 *             residual        $5,600 – $30,240  ≈ Basic low → Standard high
 *
 *   20 techs  subscription  $58,800 – $95,520
 *             reported total $64,000 – $145,000
 *             residual        $5,200 – $49,480  ≈ Basic low → Enterprise high
 *
 * Both residuals land on named endpoints of the reported implementation tiers,
 * within the owner's own rounding to the nearest thousand. Two independent
 * examples agreeing is why this is recorded as a reconstruction rather than a
 * guess — but it is still not something ServiceTitan or any contractor said,
 * so it is documented here, in the function, and NOT presented as data in
 * SERVICETITAN_COST_OF_OWNERSHIP.implementationTiers.
 *
 * The obvious alternative — map 10 techs to Basic and 20 to Standard, the way
 * a three-tier ladder invites — was rejected because it contradicts the owner's
 * own totals. It would put a ten-technician first year at $34,400–$62,760,
 * understating the reported top by $15,000, while looking more precise for
 * doing it.
 *
 * The second alternative — refuse a mapping entirely and use the full
 * $5,000–$50,000 envelope at every size — was rejected for the ten-technician
 * case only: it produces a top of $97,760 against a reported $78,000, which
 * overstates a competitor's cost by twenty thousand dollars on a public page.
 * Overstating is the direction that gets FieldQuo in trouble, and it is the
 * direction a comparison page is naturally biased toward, which is exactly why
 * it needs a rule instead of a shrug.
 *
 * Above twenty technicians there is no anchoring example, so the twenty-
 * technician envelope is carried forward: Enterprise is the top tier reported
 * and there is nothing above it to reach for.
 */
function implementationBandFor(technicians) {
  // The boundary sits at ten because that is where the anchoring example is,
  // not because anybody reported a threshold there. A shop of eleven is
  // treated as the twenty-technician case — the conservative direction is
  // toward the wider band the owner's own larger example supports.
  if (technicians <= 10) {
    return {
      low: IMPLEMENTATION_BASIC.low,
      high: IMPLEMENTATION_STANDARD.high,
      topTier: "Standard",
      anchorExample: "ten",
    };
  }
  return {
    low: IMPLEMENTATION_BASIC.low,
    high: IMPLEMENTATION_ENTERPRISE.high,
    topTier: "Enterprise",
    anchorExample: "twenty",
  };
}

/**
 * Sanitises a technician count into something arithmetic can survive.
 *
 * Pure, total, and never throws. A marketing page may hand this a value out of
 * a URL query string, a form field or a slider, and none of those are integers
 * by construction. The rules, in order:
 *
 *   not a number at all, or ≤ 0  →  0. Zero technicians is not a customer, but
 *                                   it is a legitimate thing to ASK about, and
 *                                   the reported minimum spend still answers
 *                                   it: the floor is what you pay for nobody.
 *   fractional                   →  rounded UP. Half a technician is billed as
 *                                   a technician; rounding down would quietly
 *                                   produce the cheaper answer, which is the
 *                                   direction a comparison page must not err.
 *   at or above MAX_TECHNICIANS  →  clamped, and the note says so. Infinity is
 *                                   deliberately handled HERE rather than by
 *                                   the not-a-number branch: `Number.isFinite`
 *                                   is false for it, so the obvious guard sent
 *                                   "infinitely many technicians" to the
 *                                   SMALLEST answer on the page. Clamping is
 *                                   wrong in a direction a reader can see;
 *                                   returning zero was wrong in a direction
 *                                   that looks like a working number.
 *
 * Returns the clamp flag alongside the count so the caller does not have to
 * re-derive it and get the Infinity case wrong a second time.
 */
function technicianCount(raw) {
  const n = Number(raw);
  if (Number.isNaN(n) || n <= 0) return { count: 0, clamped: false };
  if (n >= MAX_TECHNICIANS) return { count: MAX_TECHNICIANS, clamped: true };
  return { count: Math.ceil(n), clamped: false };
}

/**
 * The reported first-year cost of ServiceTitan at a given technician count.
 *
 * Pure. No I/O, no clock, no randomness, no throwing — the same input returns
 * the same object forever, which is what lets a page render it at build time
 * and a check script assert on it.
 *
 * Returns plain numbers rather than a `Reported`, because the caller needs to
 * compare them against FieldQuo's own figures, and `Reported.valueOf` throws
 * on purpose. THE CALLER OWES THE LABEL: anything rendered from this is
 * "reported", never "ServiceTitan charges". The returned `note` carries that
 * sentence so a renderer that prints the note cannot omit it.
 *
 * What is INCLUDED: subscription at the reported per-technician band for
 * twelve months, floored at the reported $1,500/month minimum, plus the
 * implementation band that the owner's worked examples place at this size.
 *
 * What is DELIBERATELY EXCLUDED: paid training ($2,000–$5,000), the 30–50%
 * add-on uplift, data cleanup, hardware, and lost productivity. Every one of
 * them is real and reported, and every one of them would push the total up.
 * They are left out because the two figures the owner worked out himself —
 * $35,000–$78,000 at ten and $64,000–$145,000 at twenty — reconcile WITHOUT
 * them, and a first-year total that quietly exceeds the owner's own worked
 * example is a number nobody can check against anything. The excluded items
 * belong beside the total as a named list, which is what `hiddenCosts` and
 * `addOnModules` are for, not folded into it.
 *
 * @param {{ technicians?: number }} [input]
 * @returns {{ low: number, high: number,
 *             subscription: { low: number, high: number },
 *             implementation: { low: number, high: number },
 *             technicians: number, note: string }}
 */
export function firstYearTotal(input) {
  // Destructured inside rather than in the signature: a default parameter
  // covers `firstYearTotal()` but NOT `firstYearTotal(null)`, which throws on
  // destructuring. A pure function on a public marketing page should not have
  // a null-shaped hole in it.
  const { technicians } = input || {};
  const { count: n, clamped } = technicianCount(technicians);

  // The minimum floors BOTH ends, because it is a floor on the bill and not on
  // the rate. At six technicians or fewer the low end is the minimum rather
  // than the per-technician arithmetic; at three or fewer, so is the high end.
  const monthlyLow = Math.max(PER_TECHNICIAN_LOW * n, MINIMUM_MONTHLY);
  const monthlyHigh = Math.max(PER_TECHNICIAN_HIGH * n, MINIMUM_MONTHLY);
  const subscription = { low: monthlyLow * 12, high: monthlyHigh * 12 };

  const impl = implementationBandFor(n);
  const implementation = { low: impl.low, high: impl.high };

  const floored = monthlyLow === MINIMUM_MONTHLY || monthlyHigh === MINIMUM_MONTHLY;

  const note = [
    `Reported, not published — ServiceTitan lists no prices. First year for ${n} technician${n === 1 ? "" : "s"}.`,
    `The LOW end assumes the bottom of every reported band: $${PER_TECHNICIAN_LOW}/technician/month and the bottom of the Basic implementation tier.`,
    `The HIGH end assumes the top: $${PER_TECHNICIAN_HIGH}/technician/month and the top of the ${impl.topTier} implementation tier.`,
    floored
      ? `At this size the reported $${MINIMUM_MONTHLY.toLocaleString("en-CA")}/month minimum spend sets the ${monthlyLow === MINIMUM_MONTHLY && monthlyHigh === MINIMUM_MONTHLY ? "whole subscription" : "low end"} rather than the per-technician rate.`
      : null,
    clamped ? `Technician count clamped to ${MAX_TECHNICIANS.toLocaleString("en-CA")} for the arithmetic.` : null,
    `Excludes paid training, the reported 30–50% add-on uplift, data cleanup, hardware and lost productivity — all reported, none folded in, so the total stays reconcilable against the reported ${impl.anchorExample}-technician figure.`,
  ]
    .filter(Boolean)
    .join(" ");

  return Object.freeze({
    technicians: n,
    low: subscription.low + implementation.low,
    high: subscription.high + implementation.high,
    subscription: Object.freeze(subscription),
    implementation: Object.freeze(implementation),
    note,
  });
}

// ══ Provenance ═════════════════════════════════════════════════════════════

/**
 * Where all of the above came from, and why it can never graduate.
 *
 * competitors.js's `verification` field answers "did anybody check this
 * against the source". For every figure in this module the answer is
 * permanently no, and that is a fact about ServiceTitan rather than about our
 * diligence — which is the distinction this object exists to record. A future
 * reader finding `verification: UNVERIFIED` here should not go looking for the
 * page to check it against. There isn't one.
 */
export const SERVICETITAN_SOURCING = Object.freeze({
  tier: SOURCED_USER_REPORTS,
  verification: UNVERIFIED,
  checked: "2026-09-09",

  // Named by KIND, the way REPORTED_VIA in competitors.js does it. "Widely
  // reported" is how a rumour launders itself into a citation; saying WHICH
  // weak source lets a reader weigh it.
  obtainedVia: Object.freeze([
    Object.freeze({
      kind: "a video summary",
      what:
        "A summary of a video walking through ServiceTitan's total cost of ownership, supplied by FieldQuo's owner on 2026-09-09. Not ServiceTitan's own material, and no transcript was read.",
    }),
    Object.freeze({
      kind: "contractor forum reports",
      what:
        "Threads of contractors stating what they were quoted, what they paid to implement, and what it cost them to leave. Self-reported, unaudited, and skewed by who chooses to post about their software bill.",
    }),
  ]),

  // Nobody established which dollar. Both sources are American, which is a
  // reason to suspect and not a reason to state — the same trap Projul's
  // currency sat in, and there is no owner assertion covering it here.
  currency: CURRENCY_NOT_STATED,

  whyNeverVerifiable:
    "ServiceTitan publishes no page any of this could be checked against. Their pricing page carries zero dollar amounts and says \"Request Pricing\" three times, once per tier — a deliberate choice, verified against their served HTML on 2026-08-28 and recorded in lib/marketing/competitors.js. Verification requires a source to verify against; there is none, so these figures stay UNVERIFIED permanently rather than pending. Marking them verified would require a source that does not exist, which is why no future update can promote them.",

  mustBeRenderedAs:
    "Contractors report. Never \"ServiceTitan charges\", never \"ServiceTitan's price is\", never a single number, never a midpoint. Money bands are Reported instances: render with String(band), which carries the label; there is no .low to print on its own.",

  separateFrom:
    "lib/marketing/competitors.js, which holds figures read off a company's own published page. The two must not share a table — see this file's header for why blending them is the dishonest version of a true argument.",
});

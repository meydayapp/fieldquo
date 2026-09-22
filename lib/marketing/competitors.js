// lib/marketing/competitors.js
//
// What FieldQuo is allowed to say, in public, about four named companies.
//
// ══ Why this is a data model and not a table of numbers ════════════════════
//
// /pricing wants to show a visitor that FieldQuo costs less than Jobber,
// Housecall Pro, ServiceTitan and Projul. Those are real businesses. A number
// that is wrong here is not a rendering bug — it is a false public statement
// about a competitor's prices, sitting on a static page where nobody is
// watching it, for as long as it takes someone to notice.
//
// So the figures are not the interesting part of this file; the states around
// them are. Every one of the following is a DIFFERENT thing, and the bug this
// module exists to make impossible is any two of them collapsing:
//
//   • they charge nothing                    → PRICE_FREE
//   • they deliberately publish no price     → PRICE_ON_REQUEST
//   • the plan does not exist at this size   → PRICE_NOT_OFFERED
//   • we have not established their price    → PRICE_UNKNOWN
//   • they print "$4,788" and never say
//     which country's dollar                 → CURRENCY_NOT_STATED
//   • we never looked at what currency it is → CURRENCY_UNKNOWN
//   • somebody read it off the live page     → VERIFIED (+ verifiedBy)
//   • somebody remembered it in a chat       → UNVERIFIED
//   • somebody read it and did not fully
//     understand what they read              → `unresolved`
//
// ══ And WHERE a statement came from: three tiers, never collapsed ══════════
//
// `verification` answers "did anyone check this against the source". It does
// not answer "what KIND of source". Those are different questions, and the
// second one got answered by accident, because there was only ever one kind of
// source: the vendor's own page. There are now three, and a reader is owed the
// difference:
//
//   SOURCED_PUBLISHER       the company printed it themselves. Housecall Pro's
//                           "$59 /mo" and its "All prices are in USD" footer.
//                           The strongest tier, and the only one that may
//                           carry a comparative claim against a competitor.
//
//   SOURCED_OWNER_ASSERTED  FieldQuo's owner says so, on stated grounds, and
//                           signs it. Projul's currency is this: their page
//                           names no currency at all, and he has twice stated
//                           the figures are US dollars, reasoning that Projul
//                           is a US company. That is a legitimate business
//                           judgement he is entitled to make, and it is NOT a
//                           reading of their page — so it is recorded as what
//                           it is, with who asserted it, when, and on what
//                           grounds. Collapsing it into VERIFIED would put his
//                           reasoning in their mouth.
//
//   SOURCED_USER_REPORTS    third-hand. ServiceTitan publishes nothing, and
//                           what circulates is a video summary and a forum
//                           thread of contractors saying what they pay. This
//                           may never be rendered the way a publisher figure
//                           is, may never be stated as a fact about
//                           ServiceTitan's pricing, and is always a RANGE that
//                           never collapses to a midpoint.
//
// The tiers gate different things, and the asymmetry is deliberate. A
// CONCESSION (theyHaveWeDont — something a competitor has and we do not) may
// publish on an owner assertion, because the only party a wrong concession
// harms is us. A CLAIM OF ADVANTAGE (weHaveTheyDont) may not: it is a
// statement about somebody else's product and it needs their own page behind
// it. `claims()` encodes that; it is not left to a renderer.
//
// AGENTS.md failure class 5: "Absence of a statement is not a statement." A
// blank where a currency should be, filled in with USD because most SaaS is
// priced in USD, is exactly that failure with a lawyer attached.
//
// ══ Why every figure carries COORDINATES, not just a number ════════════════
//
// Jobber taught this one expensively. Two summariser reads of their pricing
// page on the same day disagreed — Grow at $199 and at $156, Plus at $499 and
// at $490 — and both were "right". Their price depends on TWO selectors the
// visitor sets: team size (Just me / 2-5 / 6-10 / 11-15 / 16+) and billing
// (Annual, or Monthly split into a 1-year commitment and no commitment). A
// reader who ignores the selectors reports one arbitrary combination as "the"
// price, and two such readers disagree.
//
// So a figure without its coordinates is not a figure. Each competitor
// declares the `axes` its pricing turns on, and every figure must carry a
// value for each. ServiceTitan declares none because it publishes no price;
// that is a coordinate-free fact and it is allowed to be one.
//
// ══ The STORED figure is never converted, and never will be ════════════════
//
// This file used to ban currency conversion outright, anywhere, forever. That
// was too blunt and the owner was right to push back: a Canadian reading
// "$399 USD" beside "$369 CAD" cannot compare them without doing the exchange
// arithmetic in his head, and asking a visitor to do arithmetic we could do
// for him is a worse page, not a safer one.
//
// So the rule has been NARROWED, not lifted, and the narrowing is precise:
//
//   • The DATA stays unconverted forever. Every `amount` below is the figure
//     as published, in the currency as published. The check enforces this
//     structurally — no decimal literal may appear in this file's code (an FX
//     rate is a decimal), no identifier may name a currency or a conversion,
//     and every `amount` must be a bare integer literal so that nobody can
//     multiply on the way in. A stored converted number is one that was true
//     the day it shipped and is wrong every day after, on a statically
//     rendered page, unwatched. That was always the real danger and it is
//     still banned.
//
//   • CONVERSION FOR DISPLAY lives in lib/marketing/fx.js, a separate module
//     this one does not import and must never import. It carries a rate, the
//     date that rate was read and the source it was read from; it goes stale
//     and refuses past its window; and everything it returns is an
//     `Approximate` that holds no reachable bare number, so a renderer cannot
//     print a converted figure without the rate and the date beside it.
//
// The one-way dependency is the whole safeguard. fx.js imports this file to
// find out what a competitor published; this file cannot reach fx.js, so no
// figure here can arrive pre-converted. check-competitors.mjs asserts the
// import does not exist and that no decimal ever appears here, which means the
// rate physically cannot be stored in this file even by accident.
//
// FX never touches OUR prices. SEAT_LADDER carries the SAME NUMBER in both
// currencies (lib/pricing/ladder.js) — 99 CAD and 99 USD are both real
// FieldQuo prices, not a conversion of one another. Running our own ladder
// through an exchange rate would invent a price we do not charge, so fx.js
// converts only observations recorded in COMPETITORS below, by id.
//
// If a competitor themselves publishes a CAD price, that is a published fact
// and belongs here as a CAD figure with its own source URL. Quoting what they
// print has never been converting.
//
// ══ Why observations carry a VANTAGE POINT ═════════════════════════════════
//
// Every page below was read from a US egress, and Jobber is a Canadian company
// whose page says "All prices in USD". That establishes what a US visitor is
// shown. It does not establish "Jobber's price" — a Canadian visitor may be
// served CAD, and Canada is most of who FieldQuo competes for. `observedFrom`
// records the vantage so a figure cannot be quoted out of the geography it was
// true in.
//
// ══ Why FieldQuo's own numbers are imported, not restated ══════════════════
//
// Failure class 4. A comparison table with FieldQuo's prices typed into it is
// the copy that rots, because it is the one nobody looks at when the ladder
// changes. SEAT_LADDER is the price the product actually charges.
//
// ══ How a human marks a figure confirmed ═══════════════════════════════════
//
// Open the `source` URL. Set the SELECTORS to the figure's own coordinates.
// Read the figure off the page with your own eyes. Then, in this file:
//
//   1. set `checked` to today's date (ISO, YYYY-MM-DD),
//   2. set `verification: VERIFIED`,
//   3. set `verifiedBy` to who you are and HOW you looked — the method matters,
//      because "a summariser told me" and "I drove the page in a browser" are
//      not the same evidence, and the first version of the Jobber entry in
//      this file was built on the weaker one and was entirely wrong,
//   4. set `observedFrom` to the country you were browsing from,
//   5. if anything on the page did not make sense, say so in `unresolved`
//      rather than picking the reading that suits us.
//
// `verifiedBy` is required whenever `verification` is VERIFIED and the check
// enforces it, so the flag cannot be flipped without somebody signing it.

import { SEAT_LADDER, SUPPORTED_CURRENCIES } from "@/lib/pricing/ladder";

/**
 * Frozen all the way down, not just at the top.
 *
 * `Object.freeze(array)` leaves every object inside it writable, so a renderer
 * could set `figure.price.currency = "CAD"` on the way to the screen and the
 * conversion this file refuses to do would happen anyway, one layer up, with
 * no comment explaining it. Deliberately NOT applied to SEAT_LADDER, which is
 * imported and belongs to the pricing code — freezing another module's export
 * from here is a side effect nobody would look for.
 */
function deepFreeze(value) {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

// ── Price absence, as four separate facts ──────────────────────────────────

/** They publish an amount. Carries `amount`, `per` and `currency`. */
export const PRICE_AMOUNT = "amount";
/** They publish that it costs nothing. Still carries a `currency` — "free" in
 *  a plan table is a price, and the tier it sits beside is priced in something. */
export const PRICE_FREE = "free";
/** They have a price and deliberately do not print it. Carries `ask`: the
 *  literal words on the button, because "Request Pricing" is the evidence that
 *  this is a choice and not an omission. */
export const PRICE_ON_REQUEST = "on_request";
/** The plan is not sold at this point on the axes at all — Jobber offers no
 *  Plus tier to a single user. Distinct from every other kind: they are not
 *  withholding a price and we are not missing one, the product is simply not
 *  on the shelf. Rendering this as "unknown" would invent a gap in our
 *  research; rendering it as "on request" would invent a sales call. */
export const PRICE_NOT_OFFERED = "not_offered";
/** Nobody has established this. Renders as nothing. Never renders as "free". */
export const PRICE_UNKNOWN = "unknown";
/** Not a price at all: a band of figures buyers say they were quoted, for a
 *  vendor that publishes nothing. Carries a `Reported`, never an `amount` —
 *  see the class below for why the numbers are unreachable on purpose. */
export const PRICE_REPORTED_RANGE = "reported_range";

export const PRICE_KINDS = Object.freeze([
  PRICE_AMOUNT,
  PRICE_FREE,
  PRICE_ON_REQUEST,
  PRICE_NOT_OFFERED,
  PRICE_UNKNOWN,
  PRICE_REPORTED_RANGE,
]);

// ── Where a statement came from ────────────────────────────────────────────
//
// See the header. Three tiers, and the vocabulary is closed so a fourth cannot
// be invented in a data literal.

/** The company published it themselves, and WE read it off their site. */
export const SOURCED_PUBLISHER = "publisher";
/** The owner read their page and told us what it says; we did not read it.
 *  A report OF the publisher, at one remove — which is a different thing from
 *  reading it, and the difference is not academic: the first Jobber entry in
 *  this file was built on a relay and was entirely wrong. Distinct from
 *  OWNER_ASSERTED, which is an inference their page does not support. */
export const SOURCED_OWNER_RELAYED = "owner_relayed";
/** FieldQuo's owner asserts it, on stated grounds, and signs it. Their page
 *  does not say it and would not, however carefully you read it. */
export const SOURCED_OWNER_ASSERTED = "owner_asserted";
/** Buyers say so. Third-hand, never a fact about the vendor's price list. */
export const SOURCED_USER_REPORTS = "user_reports";

/** Strongest first. The order is meaningful and is what `claimPublishable`
 *  and `withholdReason` cut against; it is not alphabetical by accident. */
export const SOURCING_TIERS = Object.freeze([
  SOURCED_PUBLISHER,
  SOURCED_OWNER_RELAYED,
  SOURCED_OWNER_ASSERTED,
  SOURCED_USER_REPORTS,
]);

/**
 * Is this a signed assertion, or somebody typing `SOURCED_OWNER_ASSERTED`?
 *
 * The tier is worth nothing without the three fields, for the same reason
 * `verifiedBy` is required beside VERIFIED: a flag anyone can set is not
 * evidence. WHO said it, WHEN, and on WHAT GROUNDS — the grounds especially,
 * because "Projul is a US company" is a reason a reader can weigh, and "it's
 * USD" is not.
 */
export function isSignedAssertion(a) {
  return Boolean(
    a &&
      typeof a.who === "string" && a.who.length > 3 &&
      /^\d{4}-\d{2}-\d{2}$/.test(a.on || "") &&
      typeof a.grounds === "string" && a.grounds.length > 15,
  );
}

/**
 * How a reader should be told where this came from — never blank.
 *
 * A renderer that wants to print an owner-asserted figure has to print this
 * beside it, and there is nothing else to print: the tier alone is a machine
 * token and "owner_asserted" on a marketing page means nothing to anybody.
 */
export function provenanceLabel(entry, { subject } = {}) {
  const who = subject || "them";
  switch (entry?.sourcing) {
    case SOURCED_PUBLISHER:
      return entry?.checked
        ? `read off their own page on ${entry.checked}`
        : "read off their own page";
    case SOURCED_OWNER_RELAYED: {
      const a = entry.relayedBy;
      return isSignedAssertion(a)
        ? `relayed from their page by ${a.who} on ${a.on}, not read by us — ${a.grounds}`
        : "relayed with no record of who relayed it";
    }
    case SOURCED_OWNER_ASSERTED: {
      const a = entry.assertedBy;
      return isSignedAssertion(a)
        ? `asserted by ${a.who} on ${a.on}, not stated on their page — ${a.grounds}`
        : "asserted with no assertion on record";
    }
    case SOURCED_USER_REPORTS:
      return `reported by buyers, not published by ${who}`;
    default:
      return "provenance not recorded";
  }
}

/**
 * A band of figures buyers report, which must never become one number.
 *
 * ══ Why this is a class and not `{ low, high }` ════════════════════════════
 *
 * ServiceTitan publishes nothing. What we have is a video summary and a forum
 * thread — contractors saying what they were quoted. That is worth printing,
 * because "what do people actually pay for ServiceTitan" is the question the
 * visitor arrived with, but it is one careless template away from becoming
 * "ServiceTitan costs $272 per technician". The two ways it goes wrong are
 * printing an endpoint on its own, and averaging.
 *
 * Plain data cannot stop either: `{f.price.low}` renders, and `(low+high)/2`
 * is one line. So the endpoints live in PRIVATE fields. There is no `.low`,
 * no `.high`, no `.amount` — reading them returns undefined, and arithmetic
 * throws, because `valueOf` refuses. The only ways out are `toString()` and
 * `toJSON()`, and both emit the full band with its "reported" label attached.
 *
 * Same idea as the `Safe` wrapper in lib/export/accountingExport.js: the type
 * carries the guarantee, so a caller cannot forget it. Inverted, though —
 * `Safe` marks a value as trusted, this marks one as never to be trusted bare.
 */
export class Reported {
  #low;
  #high;
  #unit;
  #label;

  constructor({ low, high, unit, label }) {
    if (!Number.isFinite(low) || !Number.isFinite(high)) {
      throw new Error("Reported: both ends of the band are required");
    }
    // A band whose ends are equal is a number wearing a range's clothes, and
    // it would render as "$300–300". If somebody reports one figure, that is
    // a single report and belongs in a note, not here.
    if (!(low < high)) throw new Error("Reported: low must be below high — a band with one end is a number");
    this.#low = low;
    this.#high = high;
    this.#unit = unit || "";
    this.#label = label || "reported";
    Object.freeze(this);
  }

  /** Always true. A renderer can branch on it without unwrapping anything. */
  get isReported() {
    return true;
  }

  /** The band, as text, with its label — the only rendering there is. */
  toString() {
    const money = (n) => `$${n.toLocaleString("en-CA")}`;
    const unit = this.#unit ? ` ${this.#unit}` : "";
    return `${this.#label} ${money(this.#low)}–${money(this.#high)}${unit}`;
  }

  toJSON() {
    return { reported: this.toString() };
  }

  /**
   * Refuses to be a number.
   *
   * This is what stops the midpoint. `(range + 0) / 2`, `Number(range)`,
   * `Math.round(range)` and `range < 400` all route through here and all
   * throw, so an averaging line cannot be written by accident — only by
   * deleting this method, which is an act somebody has to explain.
   */
  valueOf() {
    throw new Error(
      "Reported: refuses to be used as a number. A band of what buyers say they paid has no midpoint — render it with toString(), which carries its label.",
    );
  }
}

// ── Currency, as published ─────────────────────────────────────────────────

/** The page prints a bare "$" (or equivalent) and names no currency anywhere.
 *  This is a fact ABOUT THE PAGE, established by reading it. Projul is this. */
export const CURRENCY_NOT_STATED = "not_stated";
/** Nobody has looked. Distinct from NOT_STATED: one is a finding, the other is
 *  a gap. Collapsing them is how "probably USD" becomes a published claim. */
export const CURRENCY_UNKNOWN = "unknown";

// ── Verification ───────────────────────────────────────────────────────────

export const VERIFIED = "verified";
export const UNVERIFIED = "unverified";

// ── What each company charges PER ──────────────────────────────────────────
//
// ══ Why this is data and not a sentence in a paragraph ═════════════════════
//
// Five companies, five different units. ServiceTitan is reported to charge per
// TECHNICIAN, Jobber by a team-size BAND, Housecall Pro per SEAT with extras
// priced individually, QuoteIQ per USER, Projul a FLAT ANNUAL fee with no
// per-user charge at all. FieldQuo charges for SEATS and includes CREW free.
//
// A comparison that puts those numbers in one table without saying so is
// comparing different things and looks rigorous while doing it. The specific
// error waiting to happen: a twenty-technician company is twenty billable
// people to ServiceTitan and perhaps two or three SEATS to us, because a
// technician is a field worker and a field worker is crew. That is the
// strongest true claim in this whole comparison and it is only true if
// somebody maps the units deliberately.
//
// So the unit is a first-class field with a `countsWhom` that says who is
// billed, and a `mapsTo` that says what that headcount is in our
// model — WITH the caveat, because the caveat is what keeps the argument
// honest. Our crew see their schedule, their assigned jobs and what to buy;
// they do not see prices and cannot write a quote (PERMISSION_PRESETS.worker
// in lib/permissions.js says so in those words). A ServiceTitan technician
// reportedly has mobile estimates on the Essentials tier. Counting heads
// without that caveat is the dishonest version of a true argument, and it is
// the version a prospect will catch.

export const UNIT_PER_TECHNICIAN = "per_technician";
export const UNIT_PER_USER = "per_user";
export const UNIT_PER_SEAT = "per_seat";
export const UNIT_TEAM_SIZE_BAND = "team_size_band";
export const UNIT_FLAT = "flat";
export const UNIT_SEATS_PLUS_FREE_CREW = "seats_plus_free_crew";
// Roofr's unit, and it is genuinely a sixth. Every plan card on their page
// says "Unlimited users" and their FAQ says "Roofr does not charge per seat",
// so headcount never enters the price — which is UNIT_FLAT's property. What
// makes it a different unit is what IS metered: every measurement report is
// charged per report, on every plan ("Measurement Reports are always
// pay-as-you-go, no matter which plan you're on"). A flat fee that gets
// cheaper per head as a company grows and dearer per roof as it quotes more
// is not the same shape as Projul's flat fee, and a calculator that treated
// them alike would hide the half of Roofr's bill a busy roofer actually feels.
export const UNIT_FLAT_PLUS_USAGE = "flat_plus_usage";

export const PRICING_UNITS = Object.freeze({
  [UNIT_PER_TECHNICIAN]: Object.freeze({
    key: UNIT_PER_TECHNICIAN,
    label: "Per technician, per month",
    countsWhom: "Every field technician on the payroll.",
    mapsTo: "crew",
    // The caveat is part of the mapping, not a footnote under it. A caller
    // that maps twenty technicians onto free crew without printing this is
    // making a comparison we cannot defend.
    caveat:
      "A technician is a field worker, and in FieldQuo a field worker is CREW and costs nothing. That is a real and large difference — and it is only a fair comparison where the technician does not need to quote on site. Their technicians reportedly get mobile estimates from the middle tier up; FieldQuo crew cannot write a quote at all (PERMISSION_PRESETS.worker: quotes 'none'). Somebody who needs every van to price work needs a SEAT here, not crew.",
  }),
  [UNIT_PER_USER]: Object.freeze({
    key: UNIT_PER_USER,
    label: "Per user, in fixed bands per tier",
    countsWhom: "Anybody with a login, whatever they do with it.",
    mapsTo: "seats_and_crew_together",
    caveat:
      "Their tiers include a fixed number of users and every one of them is paid, whether that person writes estimates or only reads a schedule. FieldQuo splits the same headcount in two: seats are billed, crew are not. So they are CHEAPER at one person and we pull ahead as soon as there is a van crew — and the crossover is a real number a calculator should compute rather than a claim to make.",
  }),
  [UNIT_PER_SEAT]: Object.freeze({
    key: UNIT_PER_SEAT,
    label: "Per seat, with extra seats individually priced",
    countsWhom: "Each included user, plus a stated price per additional user.",
    mapsTo: "seats_and_crew_together",
    caveat:
      "Their additional-user prices are per person with no free tier below them, so a crew of eight is eight charges. FieldQuo's crew are free but cannot originate money.",
  }),
  [UNIT_TEAM_SIZE_BAND]: Object.freeze({
    key: UNIT_TEAM_SIZE_BAND,
    label: "By team-size band, chosen on their own page",
    countsWhom: "Everyone in the business, selected as a bracket rather than a count.",
    mapsTo: "seats_and_crew_together",
    caveat:
      "The band is picked from a selector and covers everybody, so there is no per-head arithmetic to do and no free category either. See the `axes` on that competitor: a figure quoted without its band is not a figure.",
  }),
  [UNIT_FLAT]: Object.freeze({
    key: UNIT_FLAT,
    label: "Flat fee, no per-person charge",
    countsWhom: "Nobody — headcount does not enter the price.",
    mapsTo: "none",
    caveat:
      "A flat fee is the one unit that gets cheaper per head as a company grows, and past some headcount it beats us. That crossover is a point in THEIR favour and a calculator should be willing to print it.",
  }),
  [UNIT_FLAT_PLUS_USAGE]: Object.freeze({
    key: UNIT_FLAT_PLUS_USAGE,
    label: "Flat fee with unlimited users, plus a charge per measurement report",
    countsWhom: "Nobody — every plan says unlimited users. What is metered is each roof measured, not each person.",
    mapsTo: "none",
    caveat:
      "Headcount does not move this price at all, which is a point in THEIR favour a calculator must print: a twenty-person roofing crew pays the same plan price as a one-van outfit. What the plan price leaves out is the per-report charge on every measurement, which no headcount question can size — a shop that quotes forty roofs a month pays for forty reports on top. The comparison here is plan against plan; the reports are listed separately, per report, and never folded into a monthly figure.",
  }),
  [UNIT_SEATS_PLUS_FREE_CREW]: Object.freeze({
    key: UNIT_SEATS_PLUS_FREE_CREW,
    label: "Per seat, with field crew included free",
    countsWhom:
      "Only people whose permissions let them originate money — quotes, jobs, invoices, requests. Everybody else is crew and costs nothing.",
    mapsTo: "self",
    caveat:
      "A seat is read off the permission GRID, not off a job title (lib/pricing/ladder.js isBillableSeat), so promoting somebody to write quotes adds a seat whatever their row is called.",
  }),
});

/** FieldQuo's own unit, so a calculator never has to name it as a string. */
export const FIELDQUO_PRICING_UNIT = UNIT_SEATS_PLUS_FREE_CREW;

// ── The axes a competitor's pricing turns on ───────────────────────────────
//
// A closed vocabulary, so a figure cannot carry a coordinate on an axis its
// competitor never declared, and cannot omit one it did.

export const AXIS_TEAM_SIZE = "teamSize";
export const AXIS_BILLING = "billing";

/** Jobber's own team-size selector, in its own words, with the seat count each
 *  bucket includes. `usersIncluded` is what makes a cross-vendor comparison
 *  possible at all — plan NAMES do not line up across vendors, seat counts do. */
export const TEAM_SIZES = Object.freeze({
  solo: { key: "solo", label: "Just me", usersIncluded: 1 },
  "2-5": { key: "2-5", label: "2-5 people", usersIncluded: 5 },
  "6-10": { key: "6-10", label: "6-10 people", usersIncluded: 10 },
  "11-15": { key: "11-15", label: "11-15 people", usersIncluded: 15 },
  "16-plus": { key: "16-plus", label: "16 or more", usersIncluded: null },
});

export const BILLING_MODES = Object.freeze({
  annual_prepaid: { key: "annual_prepaid", label: "Annual, prepaid" },
  monthly_1yr: { key: "monthly_1yr", label: "Monthly, 1 year commitment" },
  monthly_none: { key: "monthly_none", label: "Monthly, no commitment" },
});

// ── Feature availability, as five separate facts ───────────────────────────
//
// Same discipline as price absence, and needed for the same reason. "Does this
// tier include an AI receptionist" has more than two answers, and the wrong
// collapse costs us either a false claim or $200 of understated advantage.

/** In the plan price. */
export const FEATURE_INCLUDED = "included";
/** In the plan, but the usage is bought separately. FieldQuo's own receptionist
 *  is this and it matters enormously: the FEATURE is on every plan, the TALK
 *  TIME is prepaid credit (lib/voice/credits.js). Saying "AI included" beside
 *  our $369 would be a false claim about our own price to a visitor who then
 *  hits a credit top-up on their first call. */
export const FEATURE_INCLUDED_USAGE_EXTRA = "included_usage_extra";
/** Sold as a paid add-on on top of the plan. Carries `addOn` with its price. */
export const FEATURE_ADD_ON = "add_on";
/** Established as not available on this tier. */
export const FEATURE_ABSENT = "absent";
/** Nobody checked this tier for this feature. Never renders as "absent". */
export const FEATURE_UNKNOWN = "unknown";

export const FEATURE_AVAILABILITY = Object.freeze([
  FEATURE_INCLUDED,
  FEATURE_INCLUDED_USAGE_EXTRA,
  FEATURE_ADD_ON,
  FEATURE_ABSENT,
  FEATURE_UNKNOWN,
]);

/**
 * Features worth comparing ACROSS vendors, keyed independently of tier names.
 *
 * The whole point. Jobber's Grow and FieldQuo's Scale are not comparable
 * because they sit in similar positions in their respective tables — they are
 * comparable, or not, on what they contain. Matching by name puts FieldQuo
 * Scale beside Jobber Grow at $399 without a receptionist, which understates
 * our case by $200 AND overstates what Grow gives. `comparableTier` exists so
 * a renderer cannot make that mistake by accident.
 */
export const COMPARABLE_FEATURES = Object.freeze({
  ai_receptionist: {
    key: "ai_receptionist",
    label: "AI phone receptionist",
    fieldquo: FEATURE_INCLUDED_USAGE_EXTRA,
    fieldquoEvidence:
      "lib/features/registry.js — voice_receptionist, defaultState 'on', so every company has it unless a platform admin withdraws it. Talk time is PREPAID CREDIT at the rate in lib/voice/credits.js, not part of the subscription. That file also records, from an earlier and independent read, that Jobber bills conversations rather than minutes — corroborating the $29/mo add-on and the Plus bundling below.",
  },
});

/**
 * How old may a figure be before a renderer should stop trusting it silently?
 *
 * 90 days. Justification, not a round number: every competitor here changed
 * their page between the owner writing his notes and this file being written
 * — Housecall Pro's plan NAMES had changed, and Jobber's entire tier/selector
 * structure did not resemble his description. One quarter is the shortest
 * re-check interval a two-person team will actually keep, and short enough
 * that a price cannot drift through two of a competitor's own pricing
 * revisions unnoticed.
 *
 * The check WARNS past this and does not fail: a stale figure is a scheduling
 * problem, and a build that goes red on a calendar boundary gets bypassed
 * rather than fixed. `withholdReason` is what actually keeps it off the page.
 */
export const STALE_AFTER_DAYS = 90;

/**
 * Age of a figure in whole days.
 *
 * `asOf` is REQUIRED and there is no default. `new Date()` as a default
 * parameter would make this module's answer depend on when it happens to be
 * imported — including at build time on Vercel, which is a different moment
 * from when a visitor reads the page. A caller that does not know what day it
 * is has no business deciding whether a price is fresh, so it throws.
 */
export function figureAgeDays(figure, asOf) {
  if (!asOf) throw new Error("figureAgeDays: asOf is required — see the comment above");
  const then = Date.parse(`${figure?.checked}T00:00:00Z`);
  const now = asOf instanceof Date ? asOf.getTime() : Date.parse(asOf);
  if (!Number.isFinite(then) || !Number.isFinite(now)) return null;
  return Math.floor((now - then) / 86400000);
}

export function isStale(figure, asOf) {
  const age = figureAgeDays(figure, asOf);
  // An unparseable date is treated as stale, not as fresh. The failure that
  // publishes a wrong number is the one that assumes the good case.
  return age === null || age > STALE_AFTER_DAYS;
}

/**
 * A promotional price, if one is running on the day you ask.
 *
 * ══ Why promotions never reach publishableFigures ══════════════════════════
 *
 * Jobber is running "Save up to 40%, Offer ends Aug 31" as this is written —
 * three days out. /pricing is statically rendered. A static page cannot notice
 * that a sale ended, so a promotional figure printed there is a number that is
 * true for three days and false afterwards, about somebody else's prices, with
 * nobody watching. It is also the direction that flatters THEM while live,
 * which is a strange thing to hand-build into our own comparison.
 *
 * So `publishableFigures` carries the REGULAR price only, and this function is
 * the correct API for a surface that re-renders — a dynamic page may call it
 * and get an answer that expires on its own. A statically rendered page must
 * not, and that is a renderer decision, documented here rather than enforced
 * by deleting the capability.
 */
export function livePromo(figure, asOf) {
  if (!asOf) throw new Error("livePromo: asOf is required — a promotion is only meaningful against a date");
  const promo = figure?.promo;
  if (!promo) return null;
  const ends = Date.parse(`${promo.endsAt}T23:59:59Z`);
  const now = asOf instanceof Date ? asOf.getTime() : Date.parse(asOf);
  // An unparseable or missing end date reads as EXPIRED, not as running
  // forever. Same argument as promotionIsLive in lib/pricing/ladder.js: the
  // failure that costs money is the one where a discount quietly never stops.
  if (!Number.isFinite(ends) || !Number.isFinite(now) || now > ends) return null;
  return promo;
}

/**
 * Why this figure must NOT be rendered as a claim — or null if it may be.
 *
 * Returns a reason string so the renderer can choose between hiding the row
 * and labelling it ("Projul does not state a currency"). Both are honest; a
 * silent fallback to a number is not, which is why there is no boolean-only
 * form of this function.
 */
export function withholdReason(figure, asOf) {
  if (!figure) return "no figure";
  if (!figure.source) return "no source URL";
  if (!figure.checked) return "no checked date";
  if (!figure.observedFrom) return "no vantage point recorded";
  if (figure.verification !== VERIFIED) return "not verified against the source";
  // Read, but not understood. A figure whose own reader flagged an open
  // question is not a figure anybody should publish a number from — and this
  // is deliberately NOT the same as unverified, because somebody did look.
  if (Array.isArray(figure.unresolved) && figure.unresolved.length > 0) {
    return `unresolved: ${figure.unresolved[0]}`;
  }
  const kind = figure.price?.kind;
  if (kind === PRICE_UNKNOWN) return "price not established";
  if (kind === PRICE_AMOUNT || kind === PRICE_FREE) {
    const c = figure.price.currency;
    if (c === CURRENCY_UNKNOWN) return "currency never checked";
    if (c === CURRENCY_NOT_STATED) return "the source states no currency";
    if (!SUPPORTED_CURRENCIES.includes(c)) return `currency ${c} has no FieldQuo row to compare against`;
    // ── Where the currency came from, which is a separate question ─────────
    //
    // Projul is the case that forced this. Their page prints "$4,788" and
    // names no currency anywhere; the owner asserts it is US dollars because
    // Projul is a US company. Writing `currency: "USD"` and stopping there
    // would put his reasoning in their mouth, and nothing downstream could
    // tell it apart from Housecall Pro's, which their own footer states.
    //
    // So a named currency must say WHERE IT CAME FROM, and absence is NOT
    // read as "off the page". Defaulting the missing case to SOURCED_PUBLISHER
    // is failure class 5 with a lawyer attached: it would turn every future
    // unlabelled guess into a claim that the vendor printed it.
    const from = figure.price.currencySourcing;
    if (!from) return "currency provenance not recorded";
    if (!SOURCING_TIERS.includes(from)) return `currency provenance ${from} is not a known sourcing tier`;
    if (from === SOURCED_USER_REPORTS) return "currency is third-hand, not published";
    if (from === SOURCED_OWNER_ASSERTED && !isSignedAssertion(figure.price.assertedBy)) {
      return "currency asserted with no signed assertion on record";
    }
  }
  // A reported band is never a price and never publishes down this path — it
  // has its own gate, `reportedWithholdReason`, because the questions are
  // different: a price asks "may we state this as their price", a band asks
  // "may we state that buyers said this".
  if (kind === PRICE_REPORTED_RANGE) return "a reported band is not a price — see reportedWithholdReason";
  if (isStale(figure, asOf)) return `last checked ${figureAgeDays(figure, asOf)} days ago`;
  return null;
}

/**
 * Why this REPORTED cost must not be rendered — or null if it may be.
 *
 * Deliberately a second function rather than a branch inside withholdReason.
 * The two gates answer different questions and a renderer that confuses them
 * has already made the mistake this file exists to prevent: `withholdReason`
 * clears something to be printed as a competitor's price, and nothing here
 * may ever be printed as a competitor's price. Sharing one function would
 * make that a matter of reading the code carefully.
 */
export function reportedWithholdReason(entry, asOf) {
  if (!entry) return "no entry";
  if (entry.sourcing !== SOURCED_USER_REPORTS) return "a reported cost must be sourced to user reports";
  if (entry.price?.kind !== PRICE_REPORTED_RANGE) return "a reported cost must carry a band, not an amount";
  if (!(entry.price.band instanceof Reported)) return "the band is not a Reported — a bare number could be printed";
  // Third-hand needs its sources NAMED BY KIND. "somewhere online" is how a
  // rumour launders itself into a citation; "a video summary" and "a forum
  // thread" are both weak, and saying which lets the reader weigh them.
  const via = entry.reportedVia;
  if (!Array.isArray(via) || via.length === 0) return "no reported source named";
  if (!via.every((v) => typeof v?.kind === "string" && v.kind.length > 2 && typeof v?.what === "string" && v.what.length > 10)) {
    return "a reported source does not say what kind of source it is";
  }
  if (!entry.checked) return "no checked date";
  if (entry.verification !== UNVERIFIED) {
    // Not a typo. A third-hand figure can never be VERIFIED, because there is
    // nothing to verify it against — ServiceTitan publishes no page that could
    // confirm or deny it. Marking one VERIFIED is somebody promoting hearsay.
    return "third-hand cannot be verified — there is no publisher page to check it against";
  }
  if (isStale(entry, asOf)) return `last checked ${figureAgeDays(entry, asOf)} days ago`;
  return null;
}

/**
 * The sentence a renderer prints for a reported cost. There is no other one.
 *
 * Always names the band, always names that it is reported and by whom, always
 * names that the vendor publishes nothing. A template that wanted to print
 * just the number would have to reach into a private field, and cannot.
 */
export function reportedCostText(entry, { subject } = {}) {
  if (!entry || !(entry.price?.band instanceof Reported)) return "";
  const who = subject || "the vendor";
  const kinds = (entry.reportedVia || []).map((v) => v.kind).join(" and ");
  const extra = entry.alsoReported instanceof Reported ? `, plus ${entry.alsoReported}` : "";
  // The currency caveat is not optional dressing. These bands come off US
  // forums in bare dollar signs; nobody established which dollar, and a
  // Canadian reader who assumes his own is reading a number ~38% too small.
  const cur = entry.price.currency === CURRENCY_NOT_STATED ? " Neither source states a currency." : "";
  return `${entry.price.band}${extra}. ${kinds ? `Reported in ${kinds}` : "Reported"}, not published by ${who}.${cur}`;
}

// ── The FieldQuo capability ledger ─────────────────────────────────────────
//
// One vocabulary for both directions of the comparison. A claim in either
// direction must name a key in here, so "FieldQuo has a mobile app" cannot be
// written as free text and slip past a check that only knows about structure.
//
// `has: false` entries are the ones that matter. A comparison table that lists
// only our wins is an advertisement; a visitor who buys on it, drives to a job
// and finds there is no app to open is a refund and a bad review. Housecall
// Pro's mobile app is the clearest case and it is theirs, not ours.
//
// `evidence` is how the value was established, so a later reader can re-run it
// rather than trusting this line.

export const FIELDQUO_CAPABILITIES = deepFreeze({
  mobile_app: {
    label: "Native mobile app (iOS / Android)",
    has: false,
    evidence:
      "No react-native, capacitor or expo dependency in package.json; no app manifest; no store listing. FieldQuo is a responsive web app.",
  },
  offline_use: {
    label: "Works offline",
    has: false,
    evidence: "No service worker anywhere in app/ or public/. Every screen needs the network.",
  },
  self_serve_demo: {
    label: "Book a guided demo with a salesperson",
    has: false,
    evidence:
      "app/(marketing) has no demo route. The seeded 'demo' industries in lib/demo/industries.js are sample DATA for a sales call, not a bookable slot for a prospect. Conflating them would put a button on /pricing that goes nowhere.",
  },
  // ── The five Projul lists him a feature for, that we do not have ─────────
  //
  // Added when the owner supplied Projul's per-tier feature lists. Every one
  // of these was checked against this repository rather than assumed, because
  // the temptation on a comparison page is to concede the cheap ones and go
  // quiet on the rest, and a visitor who buys on a page that went quiet is a
  // refund. Four of the five are in Projul's TOP tier, which is the honest
  // shape of the comparison: they sell more software than we do, for more.
  accounting_sync: {
    label: "Two-way sync with QuickBooks or Xero",
    has: false,
    evidence:
      "docs/INTEGRATIONS-ASSESSMENT.md, written against this repo: the strings quickbooks, zapier and xero appear in no integration code, only in prose. What exists is lib/export/accountingExport.js — a bookkeeping CSV a human imports, which is not a sync. QuickBooks Desktop is recorded there as refused outright: it needs a Windows connector we cannot ship.",
  },
  gantt_charts: {
    label: "Gantt charts and linked project timelines",
    has: false,
    evidence:
      "No occurrence of 'gantt' anywhere outside node_modules. FieldQuo schedules VISITS on a calendar; it has no dependency graph between tasks, so there is nothing for a Gantt bar to be drawn from.",
  },
  purchase_orders: {
    label: "Purchase orders to suppliers",
    has: true,
    // Was `has: false` with evidence reading "No PurchaseOrder model in
    // prisma/schema.prisma" — true when written, and stale from the day
    // /app/purchasing shipped. The page conceded purchase orders to Projul's
    // Pro tier while the help centre was describing ours; a concession we get
    // wrong understates us, which is the cheap direction, but it is still a
    // false statement about our own product on a public page.
    evidence:
      "prisma/schema.prisma has Supplier, PurchaseOrder, PurchaseOrderLine and StockMovement; app/app/purchasing/page.js is the screen (suppliers, orders received line by line, stock summed from movements) and scripts/check-purchasing.mjs executes it. Numbered PO-001 per company, sent to a supplier — the document, not a checklist row.",
  },
  daily_logs: {
    label: "Daily site logs",
    has: false,
    evidence:
      "No DailyLog model and no dailyLog identifier anywhere. 'Daily log' occurs once, as a construction checklist row in prisma/data/construction-checklists.json, which is a task somebody ticks rather than a log they file.",
  },
  geofencing: {
    label: "Geolocation and geofenced clock-in",
    has: false,
    evidence:
      "No occurrence of 'geofenc' anywhere outside node_modules. Crew clock in from a screen; nothing checks where the phone is.",
  },
  // ── The two halves of the unit argument, both written down ──────────────
  //
  // `free_crew_seats` is the strongest thing we have and `field_worker_quotes`
  // is what it costs. They are recorded as a PAIR deliberately: a renderer
  // that reaches for the first without the second is making the argument a
  // prospect will take apart in one question ("so can my guys quote on site?").
  field_worker_quotes: {
    label: "Field crew can price and send a quote from the van",
    has: false,
    evidence:
      "PERMISSION_PRESETS.worker in lib/permissions.js: quotes 'none', requests 'none', clientsProperties 'name_address_only', and its own description reads \"No prices, quotes, invoices or requests.\" A crew member who needs to quote must be given a grid above the Crew ceiling, at which point lib/pricing/ladder.js isBillableSeat counts them as a SEAT and they are billed. That is the honest limit on the free-crew argument.",
  },
  entry_price_below_our_floor: {
    // "A paid plan" until 2026-09-21, when Roofr's $0 Starter joined QuoteIQ's
    // $29.99 under this key. A free plan is below our floor too, and a label
    // that said "paid" beside a claim that said "$0" was the page arguing with
    // itself.
    label: "A plan priced below FieldQuo's cheapest rung",
    has: false,
    evidence:
      "SEAT_LADDER[0] in lib/pricing/ladder.js is Solo at 99 a month and there is nothing under it — the first month is free (TRIAL_PRICE) and then it is 99. Recorded as a capability we lack so that a competitor who starts lower is conceded structurally, rather than left to a paragraph somebody can quietly drop.",
  },
  published_price: {
    label: "Price published openly, no sales call",
    has: true,
    evidence: "app/(marketing)/pricing renders SEAT_LADDER to anyone, signed out.",
  },
  self_serve_signup: {
    label: "Sign up and start without talking to anyone",
    has: true,
    evidence: "AGENTS.md non-negotiable #1: company signup is open at /signup, first month free.",
  },
  white_label_documents: {
    label: "Quotes, invoices and emails carry the contractor's brand, not ours",
    has: true,
    evidence: "lib/documents/theme.js + lib/documentSections/ — the whole point of the product.",
  },
  free_crew_seats: {
    label: "Field crew included free — only people who originate money are billed",
    has: true,
    evidence:
      "SEAT_LADDER in lib/pricing/ladder.js carries a `crewSeats` count on every rung (5 / 8 / 11 / 15) alongside its billable `seats` (1 / 3 / 6 / 10), and isBillableSeat bills a member only when their permission grid rises above the Crew ceiling. A twenty-technician shop is therefore a handful of seats here and twenty billable people almost everywhere else. Scoped by field_worker_quotes, which is what the crew tier cannot do.",
  },
  monthly_billing: {
    label: "Pay monthly, no annual commitment required",
    has: true,
    evidence: "lib/pricing/ladder.js — monthly is the default rung; annual is an optional discount.",
  },
  bank_debit_capped: {
    label: "Bank debit in Canada capped at five dollars per payment",
    has: true,
    // Canadian pre-authorized debit is charged at Stripe's published 1% +
    // 40¢ with the $5.00 cap passed through unchanged — a $5,000 payment
    // costs the contractor $5. Cards are 3% + 30¢. The rate table is
    // executed in scripts/check-processing-fee.mjs; the claim below is
    // scoped to the cap, which is the part a competitor's flat 1% lacks.
    evidence:
      "lib/stripe/processingFee.js PROCESSING_RATES.acss_debit — capCents 500, applied as the application fee on every service-plan debit (lib/servicePlans/stripeMandate.js).",
  },
  payments_in_canada: {
    label: "Card and bank payments for a Canadian business",
    has: true,
    // Scoped to what the code does: a Canadian company connects a Stripe
    // account, takes cards, and takes pre-authorized debit at the capped rate.
    // Roofr's compare table marks its payments "U.S businesses only", which is
    // the contrast this key exists to carry — read from Canada, where most of
    // who FieldQuo competes for lives.
    evidence:
      "lib/stripe/processingFee.js PROCESSING_RATES carries card AND acss_debit (Canadian pre-authorized debit) rates; lib/pricing/ladder.js SUPPORTED_CURRENCIES includes CAD and the company's billing currency follows its address; lib/servicePlans/stripeMandate.js applies the debit mandate. scripts/check-processing-fee.mjs executes the rate table.",
  },
  ai_receptionist_no_monthly_floor: {
    label: "AI phone receptionist on every plan, with no monthly minimum",
    has: true,
    // Scoped deliberately narrowly. "AI included" would be FALSE — see
    // COMPARABLE_FEATURES.ai_receptionist. What is true, and is the stronger
    // claim anyway, is that there is no monthly floor: a one-van painter who
    // takes no calls in February pays nothing for the receptionist that month.
    evidence:
      "lib/features/registry.js voice_receptionist defaultState 'on'; lib/voice/credits.js — prepaid credit, explicitly 'Not bundled as N conversations included', and no monthly minimum. Jobber's entry point for the same feature is a $29/mo add-on whether or not it takes a call.",
  },

  // ── Three more, from the Roofr and PaintScout reads ──────────────────
  //
  // Added when those two pricing pages were read on 2026-09-21. Same rule as
  // the Projul five above: each was checked against this repository rather
  // than assumed, and the cheap temptation — concede the demo, go quiet on
  // the measurement report — is the temptation this ledger exists to refuse.
  measured_roof_report: {
    label: "A roof measurement report with measured edge lengths",
    has: false,
    // The narrow, true statement. We DO measure a roof from the address
    // (aerial_measure in the feature matrix): Google Solar returns the sloped
    // area, the predominant pitch and the per-facet geometry, and
    // lib/measure/roofGeometry.js derives the footprint perimeter and the total
    // internal edge length from it exactly. What it cannot do is say which
    // internal foot is ridge, hip or valley — that split is a CONVENTION read
    // off the azimuth pattern, and the module labels it as such wherever it
    // surfaces. Roofr sells a per-roof report that lists those edges
    // (hips, valleys, ridges, flashing) as measured, with a delivery guarantee.
    // That is a different product from a derived estimate, and a roofer who
    // orders material off the edge lengths needs to know which one he has.
    evidence:
      "lib/measure/roofMeasurement.js measures area and pitch from Google Solar's buildingInsights; lib/measure/roofGeometry.js says in its own header that the ridge/hip/valley split is 'CONVENTION, and labelled as such wherever it surfaces' — 'Nothing in the Solar response says which side of a shared edge slopes away from it'. Every derived number lands in a field the estimator can overwrite. There is no report document, no per-roof order, and no delivery guarantee.",
  },
  integration_marketplace: {
    label: "Connects to other tools (Zapier, CompanyCam)",
    has: false,
    evidence:
      "The strings zapier and companycam appear in app/ and lib/ only in comments (app/components/auth/AuthAside.js, app/components/jobs/JobPhotoTimeline.js) and in lib/help/tree.js's own article titled 'No public API or Zapier, yet'. docs/INTEGRATIONS-ASSESSMENT.md records the decision: outbound webhooks are the thing to build, a published Zapier app is refused for now. Nothing is wired.",
  },
  community: {
    label: "A customer community to ask other contractors",
    has: false,
    evidence:
      "No forum, group or community route anywhere under app/; the word appears in lib/ only inside a tax table, a crawler and a sales script. Support is the help centre (lib/help/tree.js) and chat with FieldQuo, not with other contractors.",
  },

  // ── Four the page was leaving on the table ────────────────────────────
  //
  // The owner listed them: the AI quote review, the kitchen designer, the AI
  // photo read, and AI image generation. Every one has an implementation and
  // none of them was on the comparison, which is a page whose entire job is to
  // say what FieldQuo does that the alternative does not.
  //
  // Each `evidence` string names the file, because that is what makes a claim
  // on a public page checkable rather than asserted — and the same rule that
  // keeps an unverified PRICE off this page is what lets a verified FEATURE on.
  ai_quote_review: {
    label: "Every quote read back before it goes out — free, on every quote",
    has: true,
    // Scoped to what the code does rather than to an outcome. "Increases your
    // win rate" is the claim we cannot substantiate; "tells you what you left
    // off and how the price compares to what you have won" is the claim the
    // file supports.
    evidence:
      "lib/ai/quoteReview.js runs on every quote. Its valuable half is arithmetic rather than language: completeness checks from lib/quotes/completeness.js, and the price compared against this company's OWN accepted and declined history — never a cross-tenant benchmark, which the file calls 'a data leak dressed up as a feature'. lib/features/registry.js distinguishes it from the paid deep photo read by calling it 'the free review that runs on every quote'.",
  },
  kitchen_designer: {
    label: "A kitchen designer that prices as it draws",
    has: true,
    evidence:
      "lib/kitchen/ — the cabinet designer, themed to the company's own brand through designerTheme.js so what a homeowner is shown carries the contractor's colours rather than ours. The layout feeds the quote instead of being a separate drawing somebody re-types.",
  },
  ai_photo_read: {
    label: "AI that reads the job photos, not just stores them",
    has: true,
    evidence:
      "lib/ai/visionPass.js — a closer read of a quote's photos at higher detail than the free review, priced per pass off the company's AI credit rather than bundled into a tier. lib/ai/imageEconomics.js carries the per-pass arithmetic.",
  },
  ai_image_generation: {
    label: "Marketing images generated from a reference photo of your own work",
    has: true,
    evidence:
      "lib/ai/images.js generates through lib/ai/provider.js — the only file allowed to talk to the vendor — resizing the reference photo before it is sent and storing the result as a durable Cloudinary URL. lib/designer/aiImageAdapter.js is where the designer surface reaches it.",
  },
});

/** The honest half of the comparison, derived rather than restated. */
export const FIELDQUO_LACKS = Object.freeze(
  Object.keys(FIELDQUO_CAPABILITIES).filter((k) => FIELDQUO_CAPABILITIES[k].has === false),
);

// ── FieldQuo's own side of the table ───────────────────────────────────────
//
// Imported, not typed. `sameNumberBothCurrencies` is the fact that makes a
// conversion unnecessary: the CAD and USD Plan rows carry identical numbers,
// so a USD competitor is compared against the USD row directly.

export const FIELDQUO_REFERENCE = Object.freeze({
  ladder: SEAT_LADDER,
  currencies: SUPPORTED_CURRENCIES,
  sameNumberBothCurrencies: true,
  entryTier: SEAT_LADDER[0],
});

// ── The competitors ────────────────────────────────────────────────────────
//
// Everything below was established on 2026-08-28 from a US vantage point. Read
// the `verifiedBy` line on each figure before trusting it.

const HOUSECALL_PRO_PRICING = "https://www.housecallpro.com/pricing/";
const JOBBER_PRICING = "https://www.getjobber.com/pricing/";
const SERVICETITAN_PRICING = "https://www.servicetitan.com/pricing";
const PROJUL_PRICING = "https://projul.com/pricing/";
const QUOTEIQ_PRICING = "https://myquoteiq.com/pricing/";
const ROOFR_PRICING = "https://roofr.com/pricing";
const PAINTSCOUT_PRICING = "https://www.paintscout.com/pricing";
const PAINTSCOUT_INTEGRATIONS = "https://www.paintscout.com/integrations";
const PAINTSCOUT_ESTIMATES = "https://www.paintscout.com/painting-estimates";

const SERVED_HTML =
  "claude/opus-5 — fetched the page and read the figure out of the served HTML, not out of a summary";
// A third method, and stronger than either for the one question that keeps
// going wrong. QuoteIQ's visible page prints "$29.99/mo" with no currency
// beside it — the same shape as Projul, which forced the owner-asserted tier.
// Their served HTML also carries schema.org Offer markup, and every one of the
// ten offers in it names `"priceCurrency": "USD"` explicitly. That is the
// publisher stating the currency in machine-readable form: not a guess, not an
// inference from where the company is registered, their own statement.
const STRUCTURED_DATA =
  "claude/opus-5 — fetched the page and read the figure out of the schema.org Offer markup in the served HTML, where each tier carries its own price and an explicit priceCurrency";

// Roofr's page is a Webflow build whose monthly/annual toggle swaps the
// visible figure from `data-monthly` and `data-annual` attributes on the price
// element itself. Reading those attributes is reading what the page prints in
// both toggle positions at once, without driving the toggle — the publisher's
// own figure for each billing mode, in machine-readable form. Same standing as
// STRUCTURED_DATA: not a summary, not an inference, their markup.
const DATA_ATTRIBUTES =
  "claude/opus-5 — fetched the page from a Canadian connection and read the figure out of the price element's own data-monthly / data-annual attributes in the served HTML, which are what the page's billing toggle displays";

const IN_BROWSER =
  "claude/opus-5 — drove the live page in a browser, JS rendered and cookie banner rejected, setting the page's own team-size and billing selectors to this figure's coordinates";

// The sale Jobber is running as this is written. Named once so that when it
// ends, one edit retires every promotional figure below.
const JOBBER_PROMO_ENDS = "2026-08-31";

// ── The owner's two assertions about Projul ────────────────────────────────
//
// Both are SOURCED_OWNER_ASSERTED and neither is a reading of Projul's page.
// Written out in full, once, and referenced — so that if he changes his mind
// one edit retires every figure that leans on it, and so that a reader can see
// the reasoning rather than a flag.

const OWNER = "Emilio Boves, FieldQuo's owner";

// ── Where the ServiceTitan numbers actually come from ──────────────────────
//
// Named by KIND, not just cited. "Widely reported" is how a rumour launders
// itself into a citation; "a video summary" and "a forum thread" are both
// weak, and saying WHICH is what lets a reader weigh them. Neither is
// ServiceTitan, and neither is a URL we can send somebody to and stand behind,
// which is itself part of the disclosure.
//
// One shared list, because both bands and all six structural terms rest on the
// same two sources — and if a third turns up, or one of these is discredited,
// it is one edit rather than nine.
const REPORTED_VIA = Object.freeze([
  Object.freeze({
    kind: "a video summary",
    what: "A summary of a video walking through ServiceTitan's pricing, supplied by the owner. Not ServiceTitan's own material, and no transcript was read.",
  }),
  Object.freeze({
    kind: "a forum thread",
    what: "A Reddit thread of contractors stating what they were quoted and what they pay. Self-reported, unaudited, and skewed by who chooses to post about their software bill.",
  }),
]);

const PROJUL_CURRENCY_ASSERTION = Object.freeze({
  who: OWNER,
  on: "2026-08-29",
  grounds:
    "Projul is a US company, so its published annual figures are US dollars.",
  // What this is NOT, stated so nobody has to reconstruct it later.
  contradicts: null,
  note:
    'Stated twice, in chat, as a business judgement he is entitled to make. It is not a reading of their page: the served HTML at projul.com/pricing contains the two dollar-code strings and the word "dollars" zero times, which is the finding recorded against these figures on 2026-08-28 and is unchanged. Earlier versions of this file withheld all three amounts for exactly that reason. They now publish, on his assertion, labelled as his assertion — which is a different and more useful thing than an empty column, and a strictly more honest thing than a bare number.',
});

const PROJUL_FEATURES_RELAY = Object.freeze({
  who: OWNER,
  on: "2026-08-29",
  grounds:
    "He supplied Projul's per-tier feature lists directly, tier by tier, in the shape their pricing page presents them.",
  note:
    "SOURCED_OWNER_RELAYED, not SOURCED_OWNER_ASSERTED, and the difference is why there are four tiers rather than three. Here he is REPORTING what their page says; about the currency he is INFERRING something their page does not say. A relay is stronger than an inference and weaker than a read, and it sits between them.\n\nWeaker than a read is not a formality. The QuoteIQ entry in this file began as a relay of four tiers, and reading their page found a fifth above them and an annual option on every one — nothing he gave was wrong, it was incomplete in a direction that changed the shape of the ladder. Somebody should re-read projul.com/pricing for exactly that reason.",
});

export const COMPETITORS = deepFreeze([
  {
    id: "housecall_pro",
    name: "Housecall Pro",
    homepage: "https://www.housecallpro.com/",
    pricingUnit: UNIT_PER_SEAT,
    pricingUnitSourcing: SOURCED_PUBLISHER,
    axes: [AXIS_BILLING],
    figures: [
      {
        id: "housecall_pro.basic.annual",
        label: "Basic",
        axis: { billing: "annual_prepaid" },
        seatsIncluded: 1,
        price: { kind: PRICE_AMOUNT, amount: 59, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        cta: "Get Started",
        source: HOUSECALL_PRO_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          'Served HTML reads "Save $20/mo $59 /mo (Billed annually)" and "1 user included". The currency is stated on the page itself: "All prices are in USD and are exclusive of sales tax."',
      },
      {
        id: "housecall_pro.basic.monthly",
        label: "Basic",
        axis: { billing: "monthly_none" },
        seatsIncluded: 1,
        price: { kind: PRICE_AMOUNT, amount: 79, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        cta: "Get Started",
        source: HOUSECALL_PRO_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note: 'Comparison table row: "$59 /mo $79 /mo" — the second figure is the no-commitment monthly rate.',
      },
      {
        id: "housecall_pro.essentials.annual",
        label: "Essentials",
        axis: { billing: "annual_prepaid" },
        seatsIncluded: 5,
        price: { kind: PRICE_AMOUNT, amount: 149, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        badge: "Recommended",
        cta: "Get Started",
        source: HOUSECALL_PRO_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note: '"5 users included *Additional users $100/mo each".',
      },
      {
        id: "housecall_pro.max.annual",
        label: "Max",
        axis: { billing: "annual_prepaid" },
        seatsIncluded: 8,
        price: { kind: PRICE_AMOUNT, amount: 299, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        cta: "Book Demo",
        source: HOUSECALL_PRO_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note: '"8 user included *Additional users $75/mo each". Its CTA is "Book Demo", not a self-serve trial — and it still publishes its price.',
      },
    ],
    // Their own "Included in every plan" list, quoted as printed. Three of the
    // eight are things FieldQuo does not have, and they are the three a
    // contractor notices on day one.
    theyHaveWeDont: [
      {
        capability: "mobile_app",
        claim: "Free mobile app for iOS and Android",
        sourcing: SOURCED_PUBLISHER,
        source: HOUSECALL_PRO_PRICING,
        checked: "2026-08-28",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note: 'Verbatim from their "Included in every Housecall Pro plan" list.',
      },
      {
        capability: "offline_use",
        claim: "Offline viewing",
        sourcing: SOURCED_PUBLISHER,
        source: HOUSECALL_PRO_PRICING,
        checked: "2026-08-28",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note: "Verbatim from the same list. FieldQuo needs the network for every screen.",
      },
      {
        capability: "self_serve_demo",
        claim: "Get a free demo and tailored pricing information for your business",
        sourcing: SOURCED_PUBLISHER,
        source: HOUSECALL_PRO_PRICING,
        checked: "2026-08-28",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note: 'Verbatim, beside a "BOOK A DEMO" button.',
      },
    ],
    weHaveTheyDont: [
      {
        capability: "self_serve_signup",
        claim: "Their top tier's call to action is Book Demo, not a trial",
        sourcing: SOURCED_PUBLISHER,
        source: HOUSECALL_PRO_PRICING,
        checked: "2026-08-28",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          'Basic and Essentials say "Get Started"; Max says "Book Demo" four times in the served markup. Scope the claim to the top tier — the lower two ARE self-serve and saying otherwise would be false.',
      },
    ],
  },

  {
    id: "servicetitan",
    name: "ServiceTitan",
    homepage: "https://www.servicetitan.com/",
    // Reported, like everything else numeric about them. The UNIT is the part
    // a reader can check in one sales call, and it is the part that matters:
    // per technician is what turns a twenty-van shop into a $9,000 month.
    pricingUnit: UNIT_PER_TECHNICIAN,
    pricingUnitSourcing: SOURCED_USER_REPORTS,
    // No axes: there is nothing for a coordinate to locate on a page that
    // publishes no price. An empty axis list is a statement, not an oversight.
    axes: [],
    figures: [
      {
        id: "servicetitan.starter",
        label: "Starter",
        axis: {},
        price: { kind: PRICE_ON_REQUEST, ask: "Request Pricing" },
        cta: "Request Pricing",
        source: SERVICETITAN_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          'The served HTML contains ZERO dollar amounts anywhere on the pricing page and the string "Request Pricing" exactly three times, once per tier. This is a deliberate choice, not a gap in our research — which is the whole reason PRICE_ON_REQUEST is not PRICE_UNKNOWN.',
      },
      {
        id: "servicetitan.essentials",
        label: "Essentials",
        axis: {},
        price: { kind: PRICE_ON_REQUEST, ask: "Request Pricing" },
        cta: "Request Pricing",
        source: SERVICETITAN_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note: "Same page, same finding.",
      },
      {
        id: "servicetitan.the_works",
        label: "The Works",
        axis: {},
        price: { kind: PRICE_ON_REQUEST, ask: "Request Pricing" },
        cta: "Request Pricing",
        source: SERVICETITAN_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note: "Same page, same finding.",
      },
    ],
    // ══ What contractors report paying, which is not ServiceTitan's price ══
    //
    // A THIRD sourcing tier, and it is deliberately kept out of `figures`.
    //
    // `figures` means "what their own page shows", and the assertion that
    // every figure's source host matches the competitor's own domain is one of
    // the load-bearing ones in check-competitors.mjs — it is what stops a
    // review site's stale number becoming our published claim about them. The
    // sources below are a video summary and a forum thread. They would FAIL
    // that assertion, and they should: they are not ServiceTitan speaking.
    //
    // So they live in their own array, under their own gate
    // (`reportedWithholdReason`), rendered only through `reportedCostText`,
    // which cannot produce a sentence that omits the word "reported". The
    // separation is the safeguard. A renderer walking `figures` cannot pick
    // one up by accident, because it is not in there.
    //
    // The claim being made is "contractors report paying this", not
    // "ServiceTitan charges this". Those are different sentences with
    // different truth conditions, and only the first one is ours to make.
    //
    // Every band is a `Reported`, so there is no `.low` to print on its own
    // and no midpoint to compute — `valueOf` throws. See the class.
    reportedCosts: [
      {
        id: "servicetitan.reported.starter",
        label: "Starter",
        tierPublishes: "servicetitan.starter",
        sourcing: SOURCED_USER_REPORTS,
        price: {
          kind: PRICE_REPORTED_RANGE,
          band: new Reported({
            low: 245,
            high: 300,
            unit: "per technician per month",
            label: "Contractors report paying",
          }),
          // Nobody established which dollar. Both sources are American, which
          // is a reason to suspect and not a reason to state — the same trap
          // Projul's currency sat in, and there is no owner assertion here.
          currency: CURRENCY_NOT_STATED,
        },
        alsoReported: new Reported({
          low: 5000,
          high: 15000,
          unit: "one-time",
          label: "an implementation fee of",
        }),
        // ── A floor on headcount, which is a price for a small shop ────────
        //
        // Reported as a minimum of three to five technicians. A three-person
        // shop therefore cannot buy the cheapest thing on their list at the
        // price on the list — the minimum IS the entry price. Held as a
        // Reported like every other band, so it cannot be quoted as "minimum
        // 3" or averaged into 4.
        minimumTechnicians: new Reported({
          low: 3,
          high: 5,
          unit: "technicians",
          label: "a reported minimum of",
        }),
        includes: [
          "dispatching, on a drag-and-drop board",
          "scheduling and calendar",
          "call booking with a caller-ID pop-up",
          "basic invoicing",
          "a basic price book",
          "CRM",
          "a mobile app",
          "GPS tracking",
          "payment processing",
          "basic reporting",
        ],
        // ── The excludes are the more valuable half ────────────────────────
        //
        // "Everything is in every FieldQuo plan" is a slogan until it is set
        // beside a named list of what a competitor's entry tier withholds.
        // These are the five a contractor discovers after signing an annual
        // contract, which is the shape of complaint the reports are full of.
        excludes: [
          "mobile estimates",
          "payroll management",
          "advanced reporting",
          "commission tracking",
          "service agreements",
        ],
        reportedVia: REPORTED_VIA,
        checked: "2026-08-29",
        observedFrom: "US",
        verification: UNVERIFIED,
        note:
          "Not verifiable, and marked so permanently: ServiceTitan publishes no page any of this could be checked against, which is why reportedWithholdReason refuses a reported cost that claims to be VERIFIED. The exclusion list is reported at the same standard as the price and carries the same label.",
      },
      {
        id: "servicetitan.reported.essentials",
        label: "Essentials",
        tierPublishes: "servicetitan.essentials",
        sourcing: SOURCED_USER_REPORTS,
        price: {
          kind: PRICE_REPORTED_RANGE,
          band: new Reported({
            low: 300,
            high: 400,
            unit: "per technician per month",
            label: "Contractors report paying",
          }),
          currency: CURRENCY_NOT_STATED,
        },
        alsoReported: new Reported({
          low: 10000,
          high: 30000,
          unit: "one-time",
          label: "an implementation fee of",
        }),
        minimumTechnicians: null,
        // Recorded as what it ADDS, like Projul's upper tiers, because
        // "Essentials has payroll" loses the fact that Starter does not.
        addsOverPreviousTier: [
          "mobile estimates, on site",
          "payroll management",
          "service agreements and memberships",
          "equipment tracking",
          "an enhanced customer portal",
        ],
        excludes: [
          "advanced reporting and the KPI dashboard",
          "commission tracking",
          "advanced inventory",
          "project management",
        ],
        reportedVia: REPORTED_VIA,
        checked: "2026-08-29",
        observedFrom: "US",
        verification: UNVERIFIED,
        note:
          "Same two sources as the Starter band. Mobile estimates arriving only here is the fact that bounds our own free-crew argument — see FIELDQUO_CAPABILITIES.field_worker_quotes, which concedes that our crew cannot quote either.",
      },
      {
        id: "servicetitan.reported.the_works",
        label: "The Works",
        // ── A correction, kept visible ─────────────────────────────────────
        //
        // The first pass at this entry called the tier "Enterprise", because
        // that is the word the earlier summary used, and it was linked to no
        // published tier at all: ServiceTitan's own page names Starter,
        // Essentials and The Works, and matching "Enterprise" to "The Works"
        // because both sit third is the name-matching mistake comparableTier
        // exists to prevent.
        //
        // A fuller pass of the same sources names The Works explicitly and
        // describes what it adds over Essentials, so the tiers DO line up and
        // the link is now made. The earlier reading is recorded in the note
        // rather than deleted — a correction nobody can see is a correction
        // that gets made again.
        tierPublishes: "servicetitan.the_works",
        sourcing: SOURCED_USER_REPORTS,
        price: {
          kind: PRICE_REPORTED_RANGE,
          band: new Reported({
            low: 400,
            high: 500,
            unit: "per technician per month",
            label: "Contractors report paying",
          }),
          currency: CURRENCY_NOT_STATED,
        },
        alsoReported: new Reported({
          low: 15000,
          high: 50000,
          unit: "one-time",
          label: "an implementation fee of",
        }),
        minimumTechnicians: null,
        addsOverPreviousTier: [
          "configurable payroll",
          "advanced KPI dashboards",
          "commission tracking",
          "customisable memberships",
          "full service-agreement management",
          "advanced inventory",
          "project management",
        ],
        // Nothing recorded as excluded: the reports describe this as the tier
        // that has everything. An empty list is a statement here, and it is
        // NOT the same as never having asked — which is why it is [] rather
        // than absent, and why the check requires the field to exist.
        excludes: [],
        reportedVia: REPORTED_VIA,
        checked: "2026-08-29",
        observedFrom: "US",
        verification: UNVERIFIED,
        note:
          'An earlier summary of the same sources called this tier "Enterprise" and put the top of the band at "$500+", open-ended. The fuller reading names The Works and closes the band at $500. Both readings are of the same two third-hand sources, so this is a correction rather than a second source — and the open-ended top is worth remembering the day somebody reports paying more.',
      },
    ],
    // ══ The part of this a reader can actually check ═══════════════════════
    //
    // The dollar bands are the weakest thing here and the most quotable, which
    // is a bad combination. The STRUCTURE is the story: pricing per technician
    // rather than per company, a separate five-figure implementation fee, and
    // an annual contract with no monthly option. Those change what a twelve-
    // technician shop pays by an order of magnitude more than the difference
    // between $245 and $300, and a reader can test them in one sales call
    // instead of taking our word for a number.
    //
    // Same third-hand sourcing, so they carry no numbers at all — a statement
    // with no figure in it cannot be misquoted as a price.
    reportedTerms: [
      {
        id: "servicetitan.term.per_technician",
        statement: "ServiceTitan is reported to price per technician, not per company",
        whyItMatters:
          "It is the term that decides the bill. A shop that grows from six technicians to twelve reportedly doubles what it pays; FieldQuo's ladder charges for seats that originate money and includes crew free, so the same growth may not move the rung at all.",
        sourcing: SOURCED_USER_REPORTS,
        reportedVia: REPORTED_VIA,
        checked: "2026-08-29",
        verification: UNVERIFIED,
      },
      {
        id: "servicetitan.term.implementation_fee",
        statement: "A separate one-time implementation fee is reported, on top of the subscription",
        whyItMatters:
          "A cost that does not appear in any monthly comparison, ours included. Reported as five figures, which is more than a small shop's first year of software.",
        sourcing: SOURCED_USER_REPORTS,
        reportedVia: REPORTED_VIA,
        checked: "2026-08-29",
        verification: UNVERIFIED,
      },
      {
        id: "servicetitan.term.annual_only",
        statement: "An annual contract is reported to be required, with no month-to-month option",
        whyItMatters:
          "The one structural term that lines up directly against something we do have and publish — lib/pricing/ladder.js bills monthly by default and treats annual as an optional discount.",
        sourcing: SOURCED_USER_REPORTS,
        reportedVia: REPORTED_VIA,
        checked: "2026-08-29",
        verification: UNVERIFIED,
      },
      {
        id: "servicetitan.term.early_termination",
        statement: "Early-termination penalties are reported for leaving inside the term",
        whyItMatters: "The cost of being wrong about the choice, which is the risk a first-time buyer is actually weighing.",
        sourcing: SOURCED_USER_REPORTS,
        reportedVia: REPORTED_VIA,
        checked: "2026-08-29",
        verification: UNVERIFIED,
      },
      {
        id: "servicetitan.term.add_on_modules",
        statement: "Add-on modules are reported to cost a further fraction of the base subscription",
        whyItMatters:
          "It means a quoted per-technician figure is a floor rather than a total. Recorded without the reported percentage, because a percentage of an unpublished number is arithmetic on a rumour.",
        sourcing: SOURCED_USER_REPORTS,
        reportedVia: REPORTED_VIA,
        checked: "2026-08-29",
        verification: UNVERIFIED,
      },
      {
        id: "servicetitan.term.onboarding_months",
        statement: "Onboarding is reported to take months rather than days",
        whyItMatters:
          "Time, not money, and it is the fairest comparison on the page: FieldQuo's non-negotiable is that a company signs up at /signup and starts, with nobody to talk to.",
        sourcing: SOURCED_USER_REPORTS,
        reportedVia: REPORTED_VIA,
        checked: "2026-08-29",
        verification: UNVERIFIED,
      },
    ],
    theyHaveWeDont: [],
    weHaveTheyDont: [
      {
        capability: "published_price",
        claim: "ServiceTitan publishes no price; every tier says Request Pricing",
        sourcing: SOURCED_PUBLISHER,
        source: SERVICETITAN_PRICING,
        checked: "2026-08-28",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          "The strongest and safest comparative claim on this page, because it is about the presence of text rather than about a number, and it is trivially checkable by the reader.",
      },
    ],
  },

  {
    id: "projul",
    name: "Projul",
    homepage: "https://projul.com/",
    // Their own page: "no per-user fees and unlimited projects". A flat fee is
    // the one unit that beats us at scale, and that is recorded rather than
    // left out.
    pricingUnit: UNIT_FLAT,
    pricingUnitSourcing: SOURCED_PUBLISHER,
    axes: [AXIS_BILLING],
    // ══ Two different provenances inside one figure ════════════════════════
    //
    // The AMOUNTS were read off their served HTML on 2026-08-28 and are
    // SOURCED_PUBLISHER. The CURRENCY was not on the page at all and is the
    // owner's assertion. The `includedFeatures` lists are his too — he
    // supplied them, nobody re-read the page for them this session.
    //
    // Splitting the provenance per-field rather than per-figure is the whole
    // point. Marking the figure "verified" would claim their page said USD;
    // marking it "unverified" would throw away a verbatim amount read from
    // their own HTML. Neither is true, and the page can now say exactly what
    // happened: their number, his currency.
    figures: [
      {
        id: "projul.core",
        label: "Core",
        axis: { billing: "annual_prepaid" },
        price: {
          kind: PRICE_AMOUNT,
          amount: 4788,
          per: "year",
          currency: "USD",
          currencySourcing: SOURCED_OWNER_ASSERTED,
          assertedBy: PROJUL_CURRENCY_ASSERTION,
        },
        cta: "Schedule a demo",
        source: PROJUL_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        // Their own list, tier by tier, as the owner supplied it. Recorded as
        // his assertion rather than as a page read — see
        // PROJUL_FEATURES_RELAY. Kept in their words, not translated into
        // our feature vocabulary, because renaming a competitor's feature is
        // how a comparison quietly becomes a straw man.
        includedFeatures: [
          "unlimited projects",
          "CRM",
          "eSignatures",
          "full-featured mobile app",
          "estimating",
          "invoicing and payment processing",
          "lead capture form",
          "mobile notifications",
          "photo capture and markup",
          "project management",
          "reporting",
          "scheduling",
          "task management",
          "templates",
          "premium support",
        ],
        featuresSourcing: SOURCED_OWNER_RELAYED,
        featuresRelayedBy: PROJUL_FEATURES_RELAY,
        note:
          'Amount confirmed verbatim from the served HTML: "Core $4,788 Annually Schedule a demo". The CURRENCY is a separate question and their page does not answer it — the two dollar-code strings and the word "dollars" appear zero times. It is here as the owner\'s assertion, which is what PROJUL_CURRENCY_ASSERTION records.',
      },
      {
        id: "projul.core_plus",
        label: "Core+",
        axis: { billing: "annual_prepaid" },
        price: {
          kind: PRICE_AMOUNT,
          amount: 7188,
          per: "year",
          currency: "USD",
          currencySourcing: SOURCED_OWNER_ASSERTED,
          assertedBy: PROJUL_CURRENCY_ASSERTION,
        },
        cta: "Schedule a demo",
        source: PROJUL_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        // Their list says Core+ ADDS these to Core. Stored as the delta rather
        // than as a flattened list, because "Core+ adds a client portal" is
        // the fact a reader is buying and "Core+ has a client portal" loses it.
        addsOverPreviousTier: [
          "unlimited subcontractors",
          "change orders",
          "client portal",
          "construction financials, job costing and budgeting",
          "convert estimates to tasks",
          "Gantt charts",
          "linear project timelines",
          "messaging",
          "progress billing",
          "time tracking",
          "QuickBooks Online",
        ],
        featuresSourcing: SOURCED_OWNER_RELAYED,
        featuresRelayedBy: PROJUL_FEATURES_RELAY,
        note: '"Core+ $7,188 Annually Schedule a demo". Currency asserted, not stated — see projul.core.',
      },
      {
        id: "projul.pro",
        label: "Pro",
        axis: { billing: "annual_prepaid" },
        price: {
          kind: PRICE_AMOUNT,
          amount: 14388,
          per: "year",
          currency: "USD",
          currencySourcing: SOURCED_OWNER_ASSERTED,
          assertedBy: PROJUL_CURRENCY_ASSERTION,
        },
        cta: "Schedule a demo",
        source: PROJUL_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        addsOverPreviousTier: [
          "unlimited users",
          "assemblies",
          "automated client reminders",
          "daily logs",
          "geolocation and geofencing",
          "photo reports",
          "purchase orders",
          "QuickBooks Desktop",
          "schedule conflicts",
          "selections",
          "service invoicing",
          "Spanish app translation",
        ],
        featuresSourcing: SOURCED_OWNER_RELAYED,
        featuresRelayedBy: PROJUL_FEATURES_RELAY,
        note: '"Pro $14,388 Annually Schedule a demo". Currency asserted, not stated — see projul.core.',
      },
    ],
    // ══ Six concessions, five of them new, none of them comfortable ════════
    //
    // The owner's feature lists name a lot of software we do not have. The
    // temptation is to record the cheap concession (a demo) and go quiet on
    // the expensive ones, which is how a comparison page becomes a brochure.
    // Every capability below was checked against this repository — the
    // evidence is on the FIELDQUO_CAPABILITIES entry, not asserted here — and
    // each one is labelled as coming from his lists rather than from a page
    // read, so a reader knows the standard of proof.
    //
    // They publish anyway, and that asymmetry is deliberate: a concession we
    // get wrong understates us and costs us a sale. A claim of advantage we
    // get wrong is a false statement about somebody else's product. Different
    // risks, different bars — enforced in claims(), not left to a renderer.
    theyHaveWeDont: [
      {
        capability: "self_serve_demo",
        claim: "Every Projul tier offers a scheduled demo",
        sourcing: SOURCED_PUBLISHER,
        source: PROJUL_PRICING,
        checked: "2026-08-28",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          'All three tiers carry "Schedule a demo". A prospect who wants to be walked through the software can be, and with FieldQuo they cannot.',
      },
      {
        capability: "mobile_app",
        claim: "Projul lists a full-featured mobile app on its entry tier, with mobile notifications",
        sourcing: SOURCED_OWNER_RELAYED,
        relayedBy: PROJUL_FEATURES_RELAY,
        source: PROJUL_PRICING,
        checked: "2026-08-29",
        verification: UNVERIFIED,
        note:
          "From the Core list the owner supplied. It is on their CHEAPEST tier, which makes it the concession that matters most: a contractor comparing entry tiers gets an app from them and a web page from us.",
      },
      {
        capability: "gantt_charts",
        claim: "Projul's Core+ tier adds Gantt charts and linear project timelines",
        sourcing: SOURCED_OWNER_RELAYED,
        relayedBy: PROJUL_FEATURES_RELAY,
        source: PROJUL_PRICING,
        checked: "2026-08-29",
        verification: UNVERIFIED,
        note:
          "FieldQuo schedules visits on a calendar and holds no dependencies between tasks, so this is not a missing screen — it is a missing model. Worth conceding plainly rather than answering with our calendar.",
      },
      {
        capability: "accounting_sync",
        claim: "Projul syncs with QuickBooks Online at Core+ and QuickBooks Desktop at Pro",
        sourcing: SOURCED_OWNER_RELAYED,
        relayedBy: PROJUL_FEATURES_RELAY,
        source: PROJUL_PRICING,
        checked: "2026-08-29",
        verification: UNVERIFIED,
        note:
          "The one an established shop asks about first. docs/INTEGRATIONS-ASSESSMENT.md, written after reading their own integration page on 2026-08-28, is the honest counterweight and belongs beside this rather than replacing it: what they describe is a one-way push, and our bookkeeping CSV covers much of the same ground. Desktop we have refused outright.",
      },
      // purchase_orders used to be conceded here ("we have no document you
      // send a supplier"). We do now — see FIELDQUO_CAPABILITIES — so the
      // concession is gone; claims() would have flagged it inconsistent, and
      // check:competitors fails on a concession of something we have.
      {
        capability: "daily_logs",
        claim: "Projul's Pro tier adds daily site logs and photo reports",
        sourcing: SOURCED_OWNER_RELAYED,
        relayedBy: PROJUL_FEATURES_RELAY,
        source: PROJUL_PRICING,
        checked: "2026-08-29",
        verification: UNVERIFIED,
        note: "General-contracting features. Less relevant to a one-van painter, which is an argument about fit and not a reason to leave them off the page.",
      },
      {
        capability: "geofencing",
        claim: "Projul's Pro tier adds geolocation and geofencing",
        sourcing: SOURCED_OWNER_RELAYED,
        relayedBy: PROJUL_FEATURES_RELAY,
        source: PROJUL_PRICING,
        checked: "2026-08-29",
        verification: UNVERIFIED,
        note: "Crew clock in from a screen in FieldQuo and nothing checks where the phone is.",
      },
    ],
    weHaveTheyDont: [
      {
        capability: "monthly_billing",
        claim: "Projul is annual only — all three tiers are priced Annually",
        sourcing: SOURCED_PUBLISHER,
        source: PROJUL_PRICING,
        checked: "2026-08-28",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          'Their own page argues the point for us: "Why annual plans?" and "Projul starts at $4,788/year with no per-user fees and unlimited projects." Note the second half of that sentence is a point in THEIR favour and an honest renderer should not quote the first half without it.',
      },
    ],
  },

  {
    id: "jobber",
    name: "Jobber",
    homepage: "https://www.getjobber.com/",
    pricingUnit: UNIT_TEAM_SIZE_BAND,
    pricingUnitSourcing: SOURCED_PUBLISHER,
    axes: [AXIS_TEAM_SIZE, AXIS_BILLING],
    // ══ The vantage point, which is a limit and not a footnote ═════════════
    //
    // Read from a US egress. The page's own footer says "All prices in USD.
    // Subscription plan prices exclude sales tax where applicable. Pricing
    // displayed is Annual prepaid, other billing options are available see the
    // FAQ below. More conditions apply". That establishes what a US visitor is
    // shown. Jobber is a Canadian company and may serve CAD to a Canadian
    // visitor — and Canada is most of who FieldQuo competes for. Somebody
    // browsing from Canada needs to re-read this before any of it is quoted as
    // "Jobber's price" rather than "Jobber's US price".
    geoCaveat:
      "Verified as what a US visitor is shown. Jobber is Canadian and may serve CAD in Canada; a Canadian reader must re-check before these are quoted as Jobber's price generally.",
    figures: [
      // ── Just me (1 user), Annual prepaid ──────────────────────────────
      //
      // These three carry an `unresolved` question and therefore do not
      // publish. The page shows a regular /mo, a promotional /mo for 12
      // months, and a different "then" rate — $49, $21, $29 for Core. What
      // $49 is RELATIVE to $29 was not established: it may be the
      // no-commitment monthly list price shown for contrast, or a pre-promo
      // annual rate. Both readings are plausible and they headline different
      // numbers, so the honest answer is to say we do not know rather than to
      // pick the one that flatters the comparison.
      {
        id: "jobber.core.solo.annual",
        label: "Core",
        axis: { teamSize: "solo", billing: "annual_prepaid" },
        seatsIncluded: 1,
        price: { kind: PRICE_AMOUNT, amount: 49, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        promo: { amount: 21, forMonths: 12, thenAmount: 29, endsAt: JOBBER_PROMO_ENDS, label: "Save up to 40%" },
        features: { ai_receptionist: FEATURE_ADD_ON },
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: IN_BROWSER,
        unresolved: [
          "the relationship between the $49/mo regular rate and the $29/mo post-promotion rate was not established — is $49 the no-commitment monthly list price shown for contrast, or the pre-promotion annual rate?",
        ],
        note: 'Regular $49/mo; promotion $21/mo for 12 months, then $29/mo billed annually.',
      },
      {
        id: "jobber.connect.solo.annual",
        label: "Connect",
        axis: { teamSize: "solo", billing: "annual_prepaid" },
        seatsIncluded: 1,
        price: { kind: PRICE_AMOUNT, amount: 139, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        promo: { amount: 70, forMonths: 12, thenAmount: 99, endsAt: JOBBER_PROMO_ENDS, label: "Save up to 40%" },
        // The badge moves with team size, so it is recorded ON the figure that
        // carries the size. See the correction note below.
        badge: "Recommended",
        features: { ai_receptionist: FEATURE_ADD_ON },
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: IN_BROWSER,
        unresolved: ["same open question as jobber.core.solo.annual: $139 regular versus $99 post-promotion"],
        note: "Regular $139/mo; promotion $70/mo for 12 months, then $99/mo billed annually.",
      },
      {
        id: "jobber.grow.solo.annual",
        label: "Grow",
        axis: { teamSize: "solo", billing: "annual_prepaid" },
        seatsIncluded: 1,
        price: { kind: PRICE_AMOUNT, amount: 199, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        promo: { amount: 105, forMonths: 12, thenAmount: 149, endsAt: JOBBER_PROMO_ENDS, label: "Save up to 40%" },
        features: { ai_receptionist: FEATURE_ADD_ON },
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: IN_BROWSER,
        unresolved: ["same open question as jobber.core.solo.annual: $199 regular versus $149 post-promotion"],
        note: "Regular $199/mo; promotion $105/mo for 12 months, then $149/mo billed annually.",
      },
      {
        id: "jobber.plus.solo.annual",
        label: "Plus",
        axis: { teamSize: "solo", billing: "annual_prepaid" },
        price: { kind: PRICE_NOT_OFFERED },
        features: { ai_receptionist: FEATURE_UNKNOWN },
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: IN_BROWSER,
        note:
          "No Plus tier is offered at this team size. Recorded rather than omitted: a missing row reads as an oversight, and 'they do not sell it to a one-person shop' is a fact about their product worth having.",
      },

      // ── 2-5 people (5 users), Annual prepaid ──────────────────────────
      {
        id: "jobber.connect.2-5.annual",
        label: "Connect",
        axis: { teamSize: "2-5", billing: "annual_prepaid" },
        seatsIncluded: 5,
        price: { kind: PRICE_AMOUNT, amount: 199, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        promo: { amount: 105, forMonths: 12, thenAmount: 149, endsAt: JOBBER_PROMO_ENDS, label: "Save up to 40%" },
        features: { ai_receptionist: FEATURE_UNKNOWN },
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: IN_BROWSER,
        unresolved: ["same open question as jobber.core.solo.annual: $199 regular versus $149 post-promotion"],
        note: "Regular $199/mo; promotion $105/mo, then $149/mo.",
      },
      {
        id: "jobber.grow.2-5.annual",
        label: "Grow",
        axis: { teamSize: "2-5", billing: "annual_prepaid" },
        seatsIncluded: 5,
        price: { kind: PRICE_AMOUNT, amount: 299, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        promo: { amount: 161, forMonths: 12, thenAmount: 229, endsAt: JOBBER_PROMO_ENDS, label: "Save up to 40%" },
        features: { ai_receptionist: FEATURE_ABSENT },
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: IN_BROWSER,
        unresolved: ["same open question as jobber.core.solo.annual: $299 regular versus $229 post-promotion"],
        note: "Regular $299/mo; promotion $161/mo, then $229/mo.",
      },
      {
        id: "jobber.plus.2-5.annual",
        label: "Plus",
        axis: { teamSize: "2-5", billing: "annual_prepaid" },
        seatsIncluded: 5,
        price: { kind: PRICE_AMOUNT, amount: 499, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        promo: { amount: 280, forMonths: 12, thenAmount: 399, endsAt: JOBBER_PROMO_ENDS, label: "Save up to 40%" },
        badge: "Recommended",
        // The CTA asks you to call AND the price is printed. Those are not
        // opposites, which is why `cta` is its own field rather than something
        // inferred from the price kind. The owner believed Plus published no
        // price precisely because of this button.
        cta: "Contact Sales",
        features: { ai_receptionist: FEATURE_INCLUDED },
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: IN_BROWSER,
        unresolved: ["same open question as jobber.core.solo.annual: $499 regular versus $399 post-promotion"],
        note:
          'Regular $499/mo; promotion $280/mo, then $399/mo. Receptionist marked included from the tier\'s own bullet "Never miss a lead with an AI-powered Receptionist".',
      },

      // ── 6-10 people (10 users), Annual prepaid ────────────────────────
      {
        id: "jobber.grow.6-10.annual",
        label: "Grow",
        axis: { teamSize: "6-10", billing: "annual_prepaid" },
        seatsIncluded: 10,
        price: { kind: PRICE_AMOUNT, amount: 399, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        promo: { amount: 210, forMonths: 12, thenAmount: 299, endsAt: JOBBER_PROMO_ENDS, label: "Save up to 40%" },
        features: { ai_receptionist: FEATURE_ABSENT },
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: IN_BROWSER,
        unresolved: ["same open question as jobber.core.solo.annual: $399 regular versus $299 post-promotion"],
        note: "Regular $399/mo; promotion $210/mo, then $299/mo.",
      },
      {
        id: "jobber.plus.6-10.annual",
        label: "Plus",
        axis: { teamSize: "6-10", billing: "annual_prepaid" },
        seatsIncluded: 10,
        price: { kind: PRICE_AMOUNT, amount: 599, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        promo: { amount: 315, forMonths: 12, thenAmount: 449, endsAt: JOBBER_PROMO_ENDS, label: "Save up to 40%" },
        badge: "Recommended",
        features: { ai_receptionist: FEATURE_INCLUDED },
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: IN_BROWSER,
        unresolved: ["same open question as jobber.core.solo.annual: $599 regular versus $449 post-promotion"],
        note: "Regular $599/mo; promotion $315/mo, then $449/mo.",
      },

      // ── 6-10 people, Monthly with no commitment ───────────────────────
      //
      // The only Jobber rows with NO open question, and therefore the only
      // ones that publish. Regular and post-promotion agree at $599, so there
      // is nothing to interpret. These are also exactly the rows the useful
      // comparison needs — ten users, no commitment, receptionist or not.
      {
        id: "jobber.grow.6-10.monthly_none",
        label: "Grow",
        axis: { teamSize: "6-10", billing: "monthly_none" },
        seatsIncluded: 10,
        price: { kind: PRICE_AMOUNT, amount: 399, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        features: { ai_receptionist: FEATURE_ABSENT },
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: IN_BROWSER,
        note: "$399/mo, no promotion shown on this combination.",
      },
      {
        id: "jobber.plus.6-10.monthly_none",
        label: "Plus",
        axis: { teamSize: "6-10", billing: "monthly_none" },
        seatsIncluded: 10,
        price: { kind: PRICE_AMOUNT, amount: 599, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        promo: { amount: 420, forMonths: 3, thenAmount: 599, endsAt: JOBBER_PROMO_ENDS, label: "Save up to 40%" },
        features: { ai_receptionist: FEATURE_INCLUDED },
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: IN_BROWSER,
        note:
          "Regular $599/mo; promotion $420/mo for 3 months, then back to $599/mo. Regular and post-promotion agree, so unlike the annual rows there is nothing unresolved here.",
      },

      // ── The two team sizes nobody captured ────────────────────────────
      //
      // Recorded as unknown rather than extrapolated from the curve below
      // them. Straight-lining 6-10 into 11-15 would produce a confident number
      // that no Jobber page has ever shown anyone.
      {
        id: "jobber.all.11-15",
        label: "All plans, 11-15 people",
        axis: { teamSize: "11-15", billing: "annual_prepaid" },
        price: { kind: PRICE_UNKNOWN },
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: UNVERIFIED,
        note: "This team-size selector was not opened during the browser read. Not extrapolated.",
      },
      {
        id: "jobber.all.16-plus",
        label: "All plans, 16 or more people",
        axis: { teamSize: "16-plus", billing: "annual_prepaid" },
        price: { kind: PRICE_UNKNOWN },
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: UNVERIFIED,
        note: "This team-size selector was not opened during the browser read. Not extrapolated.",
      },
    ],
    // Priced on top of a plan, not inside it. Observed at the "Just me" size;
    // no claim is made about their price at other sizes.
    addOns: [
      {
        id: "jobber.addon.marketing_suite",
        label: "Marketing Suite",
        axis: { teamSize: "solo", billing: "annual_prepaid" },
        price: { kind: PRICE_AMOUNT, amount: 99, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: IN_BROWSER,
        note: "Add-on, priced separately from the plan.",
      },
      {
        id: "jobber.addon.ai_receptionist",
        label: "Jobber AI Receptionist",
        axis: { teamSize: "solo", billing: "annual_prepaid" },
        price: { kind: PRICE_AMOUNT, amount: 29, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        feature: "ai_receptionist",
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: IN_BROWSER,
        note:
          "The single most useful figure on this page for us. It is a $29/mo floor a contractor pays whether or not a call comes in. lib/voice/credits.js records the same $29/mo from an earlier, independent read and adds that it buys 30 conversations with $0.79 each after — corroboration, not a second source, since both describe Jobber's own published terms.",
      },
      {
        id: "jobber.addon.sales_pipeline",
        label: "Sales Pipeline",
        axis: { teamSize: "solo", billing: "annual_prepaid" },
        price: { kind: PRICE_AMOUNT, amount: 49, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: IN_BROWSER,
        note: "Add-on, priced separately from the plan.",
      },
    ],
    theyHaveWeDont: [
      {
        capability: "mobile_app",
        claim: "Jobber ships mobile apps for iOS and Android",
        sourcing: SOURCED_PUBLISHER,
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        verification: UNVERIFIED,
        note:
          "Widely true and almost certainly correct, but it was not read off the pricing page during the browser session, so it is not verified and does not publish. Listed anyway so the concession is not quietly missing from the one competitor where we now have real numbers.",
      },
    ],
    weHaveTheyDont: [
      {
        capability: "bank_debit_capped",
        claim:
          "Jobber's bank payments cost 1% of the amount with no cap, where ours stop at five dollars per payment; their cards are 2.9% + 30¢ to our 3% + 30¢",
        sourcing: SOURCED_PUBLISHER,
        source: JOBBER_PRICING,
        checked: "2026-09-12",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          'Read off the served pricing page on 2026-09-12: "2.9% + 30¢" for credit cards, "1%" for bank payments (ACH), and instant payouts at an additional "1%". The page states no cap on bank payments and no separate Amex rate. Our card rate is a tenth of a point HIGHER and the claim says so — the advantage is the cap on bank debit, not the card rate, and a rep who says otherwise is contradicted by both pricing pages.',
      },
      {
        capability: "ai_receptionist_no_monthly_floor",
        claim:
          "Jobber's AI receptionist is a $29/mo add-on at one user, and otherwise sits in the $599/mo Plus tier",
        sourcing: SOURCED_PUBLISHER,
        source: JOBBER_PRICING,
        checked: "2026-08-28",
        verification: VERIFIED,
        verifiedBy: IN_BROWSER,
        note:
          "Both halves read from the page: the add-on price at Just me, and the receptionist bullet appearing only on Plus at 5 and 10 users. The FieldQuo half of this claim is deliberately narrow — no monthly floor, not 'included' — because our talk time is prepaid credit and 'included' would be false.",
      },
    ],
  },

  {
    id: "quoteiq",
    name: "QuoteIQ",
    homepage: "https://myquoteiq.com/",
    // ══ The competitor that beats us where a visitor starts looking ════════
    //
    // $29.99 a month at one user against our $99. That is not a rounding
    // difference and there is no reading of it that favours us at a headcount
    // of one, so it is recorded as a capability we lack
    // (entry_price_below_our_floor) rather than as prose somebody can drop.
    //
    // Where it turns is the CREW. Their users are all paid — every one of the
    // 1 / 2 / 4 / 10 in their tiers is a login somebody bought — and ours are
    // not. A one-van painter is cheaper on QuoteIQ. A shop with two estimators
    // and eight people in vans is ten paid users there and a Crew rung here.
    // Both halves are in the data below, in both directions, because a
    // comparison that only shows our wins is the advertisement this module was
    // written to prevent, and this is the objection a real prospect brings.
    pricingUnit: UNIT_PER_USER,
    pricingUnitSourcing: SOURCED_PUBLISHER,
    axes: [AXIS_BILLING],
    // ── What the owner supplied, and what the page turned out to say ───────
    //
    // He gave four tiers and their monthly prices, and asked for them to be
    // recorded as owner-supplied. Reading the page instead found two things
    // his list did not have, and this is exactly why the page gets read:
    //
    //   • a FIFTH tier, Max at $699/mo with unlimited users, above Elite;
    //   • an annual option on every tier, printed as its own per-month figure
    //     and its own yearly total — so there are ten figures here, not four.
    //
    // Nothing he gave was wrong. It was incomplete in a direction that
    // mattered: a comparison that stops at Elite implies their ladder stops at
    // ten users, and it does not.
    relayNote:
      "Supplied by the owner as four tiers with monthly prices, then read off their served HTML on 2026-08-29. The read added a fifth tier (Max, $699/mo, unlimited users) and the annual option on every tier. His four figures all matched.",
    figures: [
      {
        id: "quoteiq.essentials.monthly",
        label: "Essentials",
        axis: { billing: "monthly_none" },
        seatsIncluded: 1,
        price: { kind: PRICE_AMOUNT, amount: 29.99, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        cta: "Start Free Trial",
        // Their AI is metered as a monthly credit allowance per tier. Recorded
        // as a number rather than described, because "they have AI limits" is
        // not comparable to anything and "500 credits a month" is.
        aiCreditsPerMonth: 500,
        includedFeatures: [
          "create and send estimates",
          "create and send invoices",
          "scheduling and calendar",
          "accept online payments",
          "AI Virtual Call Team",
          "consumer financing",
        ],
        source: QUOTEIQ_PRICING,
        checked: "2026-08-29",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: STRUCTURED_DATA,
        note:
          'Visible page: "$29.99/mo", "1 User included", "500 AI Credits/mo". The currency is not printed beside the figure, but the page\'s Offer markup states "priceCurrency": "USD" for this tier. This is the cheapest entry price of the five competitors and it is a third of ours.',
      },
      {
        id: "quoteiq.essentials.annual",
        label: "Essentials",
        axis: { billing: "annual_prepaid" },
        seatsIncluded: 1,
        price: { kind: PRICE_AMOUNT, amount: 25, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        cta: "Start Free Trial",
        aiCreditsPerMonth: 500,
        source: QUOTEIQ_PRICING,
        checked: "2026-08-29",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: STRUCTURED_DATA,
        note:
          'Their page prints both halves itself — "$25/mo" and "Billed annually at $299.99/year" — so the per-month figure is read, not divided. Their own banner: "Save 2 months with yearly billing", which is the same deal shape as ANNUAL_FREE_MONTHS in lib/pricing/ladder.js.',
      },
      {
        id: "quoteiq.beginner.monthly",
        label: "Beginner",
        axis: { billing: "monthly_none" },
        seatsIncluded: 2,
        price: { kind: PRICE_AMOUNT, amount: 74.99, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        cta: "Start Free Trial",
        aiCreditsPerMonth: 1500,
        addsOverPreviousTier: [
          "MapMeasure Pro",
          "QuoteIQ Cam",
          "Review Multiplier",
          "e-signatures",
          "advanced analytics",
        ],
        source: QUOTEIQ_PRICING,
        checked: "2026-08-29",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: STRUCTURED_DATA,
        note: '"$74.99/mo", "2 Users included", "1,500 AI Credits/mo".',
      },
      {
        id: "quoteiq.beginner.annual",
        label: "Beginner",
        axis: { billing: "annual_prepaid" },
        seatsIncluded: 2,
        price: { kind: PRICE_AMOUNT, amount: 62.50, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        cta: "Start Free Trial",
        aiCreditsPerMonth: 1500,
        source: QUOTEIQ_PRICING,
        checked: "2026-08-29",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: STRUCTURED_DATA,
        note: '"$62.50/mo", "Billed annually at $749.99/year".',
      },
      {
        id: "quoteiq.pro.monthly",
        label: "Pro",
        axis: { billing: "monthly_none" },
        seatsIncluded: 4,
        price: { kind: PRICE_AMOUNT, amount: 149.99, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        badge: "Most Popular",
        cta: "Start Free Trial",
        aiCreditsPerMonth: 3000,
        addsOverPreviousTier: [
          "email and text automation",
          "in-app calling and texting",
          "job costing",
          "QuickBooks integration",
          "website contact form",
        ],
        source: QUOTEIQ_PRICING,
        checked: "2026-08-29",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: STRUCTURED_DATA,
        note:
          '"$149.99/mo", "4 Users included", "3,000 AI Credits/mo", badged "Most Popular". Unlike Jobber\'s, this badge does not move with a selector — there is only one, on one tier — but it is still recorded ON the figure rather than on the competitor, so the two cannot be conflated later.',
      },
      {
        id: "quoteiq.pro.annual",
        label: "Pro",
        axis: { billing: "annual_prepaid" },
        seatsIncluded: 4,
        price: { kind: PRICE_AMOUNT, amount: 125, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        badge: "Most Popular",
        cta: "Start Free Trial",
        aiCreditsPerMonth: 3000,
        source: QUOTEIQ_PRICING,
        checked: "2026-08-29",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: STRUCTURED_DATA,
        note: '"$125/mo", "Billed annually at $1,499.99/year".',
      },
      {
        id: "quoteiq.elite.monthly",
        label: "Elite",
        axis: { billing: "monthly_none" },
        seatsIncluded: 10,
        price: { kind: PRICE_AMOUNT, amount: 299, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        cta: "Start Free Trial",
        aiCreditsPerMonth: 5000,
        addsOverPreviousTier: [
          "EmployeeHub",
          "InstaQuote and InstaSchedule",
          "route optimisation",
          "pipelines and inventory",
          "mass text and email campaigns",
        ],
        source: QUOTEIQ_PRICING,
        checked: "2026-08-29",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: STRUCTURED_DATA,
        note:
          '"$299/mo", "10 Users included", "5,000 AI Credits/mo". Ten PAID users against FieldQuo Scale at $369 for ten seats and fifteen free crew — twenty-five people. This is the row where the unit difference stops being an abstraction.',
      },
      {
        id: "quoteiq.elite.annual",
        label: "Elite",
        axis: { billing: "annual_prepaid" },
        seatsIncluded: 10,
        price: { kind: PRICE_AMOUNT, amount: 249, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        cta: "Start Free Trial",
        aiCreditsPerMonth: 5000,
        source: QUOTEIQ_PRICING,
        checked: "2026-08-29",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: STRUCTURED_DATA,
        note: '"$249/mo", "Billed annually at $2,990/year".',
      },
      {
        id: "quoteiq.max.monthly",
        label: "Max",
        axis: { billing: "monthly_none" },
        // Unlimited, so there is no seat COUNT. null rather than a large
        // number: "unlimited" and "999" are different facts and a calculator
        // that divides by a made-up ceiling produces a made-up per-head price.
        seatsIncluded: null,
        unlimitedSeats: true,
        price: { kind: PRICE_AMOUNT, amount: 699, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        cta: "Start Free Trial",
        aiCreditsPerMonth: 8000,
        addsOverPreviousTier: [
          "unlimited users",
          "AI Website Builder included",
          "Sales Team Tracker",
          "priority support",
          "crew management",
        ],
        source: QUOTEIQ_PRICING,
        checked: "2026-08-29",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: STRUCTURED_DATA,
        note:
          '"$699/mo", "Unlimited Users", "8,000 AI Credits/mo". The tier the owner\'s list did not have. It matters to the comparison: above about twenty-five people their ladder goes flat and FieldQuo\'s does not — tierFor() in lib/pricing/ladder.js returns null past ten seats, which is a conversation rather than a price.',
      },
      {
        id: "quoteiq.max.annual",
        label: "Max",
        axis: { billing: "annual_prepaid" },
        seatsIncluded: null,
        unlimitedSeats: true,
        price: { kind: PRICE_AMOUNT, amount: 582.50, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        cta: "Start Free Trial",
        aiCreditsPerMonth: 8000,
        source: QUOTEIQ_PRICING,
        checked: "2026-08-29",
        observedFrom: "US",
        verification: VERIFIED,
        verifiedBy: STRUCTURED_DATA,
        note: '"$582.50/mo", "Billed annually at $6,990/year".',
      },
    ],
    theyHaveWeDont: [
      {
        capability: "entry_price_below_our_floor",
        claim: "QuoteIQ starts at $29.99 a month for one user; FieldQuo's cheapest rung is $99",
        sourcing: SOURCED_PUBLISHER,
        source: QUOTEIQ_PRICING,
        checked: "2026-08-29",
        verification: VERIFIED,
        verifiedBy: STRUCTURED_DATA,
        note:
          "The clearest loss in the whole comparison and it is at the top of the funnel, where a solo operator starts looking. Both numbers are read rather than typed: theirs off their Offer markup, ours out of SEAT_LADDER. There is no reading of a single-user comparison that favours us, and a page that fudges this is a page that gets caught on its cheapest claim.",
      },
      {
        capability: "mobile_app",
        claim: "QuoteIQ ships iOS and Android apps and tells you to download one during signup",
        sourcing: SOURCED_PUBLISHER,
        source: QUOTEIQ_PRICING,
        checked: "2026-08-29",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          'Their own getting-started steps read "Download the app on iOS or Android and log in immediately." FieldQuo is a responsive web app.',
      },
      {
        capability: "accounting_sync",
        claim: "QuoteIQ includes a QuickBooks integration from its Pro tier",
        sourcing: SOURCED_PUBLISHER,
        source: QUOTEIQ_PRICING,
        checked: "2026-08-29",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          'Listed on Pro as "QuickBooks Integration". docs/INTEGRATIONS-ASSESSMENT.md records that we have no sync at all, only a bookkeeping CSV.',
      },
      {
        capability: "self_serve_demo",
        claim: "QuoteIQ offers a scheduled demo and a phone number",
        sourcing: SOURCED_PUBLISHER,
        source: QUOTEIQ_PRICING,
        checked: "2026-08-29",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note: '"Schedule A Demo — Book a personalized walkthrough with our team", beside a support telephone number.',
      },
    ],
    weHaveTheyDont: [
      {
        capability: "free_crew_seats",
        claim:
          "Every QuoteIQ user is a paid user; FieldQuo bills only the people who originate money and includes field crew free",
        sourcing: SOURCED_PUBLISHER,
        source: QUOTEIQ_PRICING,
        checked: "2026-08-29",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          'Their tiers are "1 User", "2 Users", "4 Users", "10 Users", "Unlimited Users" and every one is a login you pay for. FieldQuo Scale is ten seats AND fifteen crew — twenty-five people — for $369. The honest scope: this is why they win at one person and we win at ten, and the claim must be made with FIELDQUO_CAPABILITIES.field_worker_quotes beside it, because our crew cannot price a job.',
      },
    ],
  },

  {
    id: "roofr",
    name: "Roofr",
    homepage: "https://roofr.com/",
    // ══ Read on 2026-09-21 from a Canadian connection ══════════════════════
    //
    // The owner's reading, before the page was opened: "plans Essentials and
    // Scale; SMS add-on $49/mo available on Essentials and Scale; Instant
    // Estimator add-on $149/mo; Roofr Sites $99/mo; measurement reports priced
    // per report." Every one of those figures matched the served HTML. What his
    // reading did not have — and the reason the page gets read rather than
    // relayed — is four things that change the shape of the comparison:
    //
    //   • a FREE tier. "Starter $0/mo", "No commitment needed", and their FAQ:
    //     "There's no time limit". It caps proposals, invoices and work orders
    //     at ten in total, which is a trial in everything but the billing, and
    //     it is still a published price of zero and is recorded as one;
    //   • a fourth base plan, Measure+, a measurement subscription at $109 or
    //     $169 a month depending on delivery time (6 hour / 2 hour);
    //   • "Unlimited users" on every plan card, and "Roofr does not charge per
    //     seat" in their FAQ. Headcount does not enter their price at all —
    //     the strongest true thing on their page and a point against us;
    //   • a fourth add-on, an AI Receptionist at $99/mo, beside the three he
    //     named.
    //
    // Their page footer says "All pricing in USD." — the publisher stating the
    // currency, read from Canada. That is a stronger vantage than the US read
    // every other competitor here has: a Canadian roofer is shown these
    // figures, in USD, and the page says so.
    pricingUnit: UNIT_FLAT_PLUS_USAGE,
    pricingUnitSourcing: SOURCED_PUBLISHER,
    axes: [AXIS_BILLING],
    geoCaveat:
      "Read from a Canadian connection on 2026-09-21. Their page says \"All pricing in USD.\" — so a Canadian visitor is shown US-dollar prices, and that is recorded rather than assumed.",
    figures: [
      {
        id: "roofr.starter.monthly",
        label: "Starter",
        axis: { billing: "monthly_none" },
        seatsIncluded: null,
        unlimitedSeats: true,
        // A published price of nothing. PRICE_FREE and not PRICE_AMOUNT 0, so
        // nothing downstream can average it, sum it or call it the cheapest
        // paid plan — and the currency still travels with it, because the
        // tiers it sits beside are priced in something.
        price: { kind: PRICE_FREE, currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        cta: "Start for free",
        includedFeatures: [
          "$19 measurement reports delivered in 24 hrs or less",
          "1 basic job board",
          "10 trial proposals, invoices & work orders",
          "5 automated actions",
          "Material ordering & supplier integrations",
          "Email & email templates",
          "Calendar & job events",
          "ESX files $12 USD / report",
          "Unlimited users",
        ],
        featuresSourcing: SOURCED_PUBLISHER,
        source: ROOFR_PRICING,
        checked: "2026-09-21",
        observedFrom: "CA",
        verification: VERIFIED,
        verifiedBy: DATA_ATTRIBUTES,
        note:
          'Plan card: "Starter — Order roof measurements and explore the Roofr platform. No commitment needed. $0/mo", data-monthly="0" data-annual="0". Their FAQ: "The Starter plan is a way to explore Roofr and see how it fits your workflow before committing to a paid plan. There\'s no time limit, and no pressure." The compare table marks proposals, invoices and work orders on this tier "Trial [10 total]".',
      },
      {
        id: "roofr.measure_plus_6h.monthly",
        label: "Measure+ (6 hour)",
        axis: { billing: "monthly_none" },
        seatsIncluded: null,
        unlimitedSeats: true,
        price: { kind: PRICE_AMOUNT, amount: 109, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        cta: "Get started",
        addsOverPreviousTier: [
          "$13 measurement reports",
          "ESX files $10 USD / report",
          "2 or 6 hour guaranteed delivery time",
          "Material calculations",
          "Waste factor",
          "CSV downloads",
          "Company logo & branding",
          "Unlimited users",
        ],
        featuresSourcing: SOURCED_PUBLISHER,
        source: ROOFR_PRICING,
        checked: "2026-09-21",
        observedFrom: "CA",
        verification: VERIFIED,
        verifiedBy: DATA_ATTRIBUTES,
        note:
          'The Measure+ card carries a 6 HOUR / 2 HOUR switch and prints "$109 - $169" as its range; the compare table splits it into two columns, "6 Hour" at data-monthly="109" data-annual="95" and "2 Hour" at data-monthly="169" data-annual="145". Their own description: "Add-on subscription (monthly) — Upgrade your Starter measurements with a monthly Measure+ subscription." It is listed among the Base Plans on the card row AND as a measurement add-on in the table; the table also marks it "Included" on Essentials and Scale.',
      },
      {
        id: "roofr.measure_plus_6h.annual",
        label: "Measure+ (6 hour)",
        axis: { billing: "annual_prepaid" },
        seatsIncluded: null,
        unlimitedSeats: true,
        price: { kind: PRICE_AMOUNT, amount: 95, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        cta: "Get started",
        source: ROOFR_PRICING,
        checked: "2026-09-21",
        observedFrom: "CA",
        verification: VERIFIED,
        verifiedBy: DATA_ATTRIBUTES,
        note: 'data-annual="95", shown as "/mo billed yearly" when the toggle is on Annual.',
      },
      {
        id: "roofr.measure_plus_2h.monthly",
        label: "Measure+ (2 hour)",
        axis: { billing: "monthly_none" },
        seatsIncluded: null,
        unlimitedSeats: true,
        price: { kind: PRICE_AMOUNT, amount: 169, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        cta: "Get started",
        source: ROOFR_PRICING,
        checked: "2026-09-21",
        observedFrom: "CA",
        verification: VERIFIED,
        verifiedBy: DATA_ATTRIBUTES,
        note: 'The 2 HOUR position of the same card: data-monthly="169".',
      },
      {
        id: "roofr.measure_plus_2h.annual",
        label: "Measure+ (2 hour)",
        axis: { billing: "annual_prepaid" },
        seatsIncluded: null,
        unlimitedSeats: true,
        price: { kind: PRICE_AMOUNT, amount: 145, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        cta: "Get started",
        source: ROOFR_PRICING,
        checked: "2026-09-21",
        observedFrom: "CA",
        verification: VERIFIED,
        verifiedBy: DATA_ATTRIBUTES,
        note: 'data-annual="145".',
      },
      {
        id: "roofr.essentials.monthly",
        label: "Essentials",
        axis: { billing: "monthly_none" },
        seatsIncluded: null,
        unlimitedSeats: true,
        price: { kind: PRICE_AMOUNT, amount: 249, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        cta: "Get started",
        addsOverPreviousTier: [
          "$13 measurement reports delivered in 2 hrs or less",
          "1 flexible job board",
          "Unlimited proposals, invoices & work orders",
          "10 automated actions",
          "Credit card & ACH payments",
          "Signable PDFs & contracts",
          "Unlimited e-signatures",
          "Unlimited users",
        ],
        featuresSourcing: SOURCED_PUBLISHER,
        source: ROOFR_PRICING,
        checked: "2026-09-21",
        observedFrom: "CA",
        verification: VERIFIED,
        verifiedBy: DATA_ATTRIBUTES,
        note:
          'Plan card: "Essentials — The essential tools to streamline your sales process from measurement to payment. $249/mo Billed monthly, or $209/mo billed yearly", data-monthly="249" data-annual="209". The bullet list is headed "Everything in Starter, plus:". Below the ticked list the card prints "SMS texting & templates" with no tick — the SMS add-on, priced in the compare table. Their FAQ places this plan: "just getting started in roofing … or a small team of 1-2, then the Essentials plan may be all you need".',
      },
      {
        id: "roofr.essentials.annual",
        label: "Essentials",
        axis: { billing: "annual_prepaid" },
        seatsIncluded: null,
        unlimitedSeats: true,
        price: { kind: PRICE_AMOUNT, amount: 209, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        cta: "Get started",
        source: ROOFR_PRICING,
        checked: "2026-09-21",
        observedFrom: "CA",
        verification: VERIFIED,
        verifiedBy: DATA_ATTRIBUTES,
        note: '"or $209/mo billed yearly". Their FAQ puts the annual discount at "about 15%".',
      },
      {
        id: "roofr.scale.monthly",
        label: "Scale",
        axis: { billing: "monthly_none" },
        seatsIncluded: null,
        unlimitedSeats: true,
        price: { kind: PRICE_AMOUNT, amount: 349, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        badge: "Most Popular",
        cta: "Get started",
        addsOverPreviousTier: [
          "7 customizable job boards",
          "Custom job tags & work types",
          "Crew management",
          "25+ automated actions",
          "Performance dashboard & reporting",
          "Profit margins & job costs",
          "Quickbooks integration",
          "Role-based permissions",
          "Unlimited users",
        ],
        featuresSourcing: SOURCED_PUBLISHER,
        source: ROOFR_PRICING,
        checked: "2026-09-21",
        observedFrom: "CA",
        verification: VERIFIED,
        verifiedBy: DATA_ATTRIBUTES,
        note:
          'Plan card: "Scale — Most Popular — The complete CRM for teams that are growing fast and need more flexibility. $349/mo Billed monthly, or $299/mo billed yearly", data-monthly="349" data-annual="299". Headed "Everything in Essentials, plus:". The compare table puts job costing, the performance dashboard, crew management and QuickBooks on this tier only.',
      },
      {
        id: "roofr.scale.annual",
        label: "Scale",
        axis: { billing: "annual_prepaid" },
        seatsIncluded: null,
        unlimitedSeats: true,
        price: { kind: PRICE_AMOUNT, amount: 299, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        badge: "Most Popular",
        cta: "Get started",
        source: ROOFR_PRICING,
        checked: "2026-09-21",
        observedFrom: "CA",
        verification: VERIFIED,
        verifiedBy: DATA_ATTRIBUTES,
        note: '"or $299/mo billed yearly".',
      },
    ],
    // Four add-ons, all read at the monthly toggle so the stack totals at one
    // point on their selectors. The SMS figure is the one the owner led with
    // ("that is wild"), and it is the one that needed the compare table rather
    // than the card: the Essentials card names it without a price, and the
    // table prices it at $49/mo on Essentials and Scale and marks it "Not
    // included" on Starter and Measure+.
    addOns: [
      {
        id: "roofr.addon.sms",
        label: "SMS",
        axis: { billing: "monthly_none" },
        price: { kind: PRICE_AMOUNT, amount: 49, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        source: ROOFR_PRICING,
        checked: "2026-09-21",
        observedFrom: "CA",
        verification: VERIFIED,
        verifiedBy: DATA_ATTRIBUTES,
        note:
          'Compare table row "SMS (Monthly) — Send and track SMS texts directly from the job card for better customer communication": ✕ Starter, ✕ Measure+, then a price cell on Essentials and on Scale reading data-monthly="49" data-annual="45". So $49/mo, or $45/mo billed yearly, and only on the two paid CRM plans. Recorded at the monthly toggle, with the annual figure in this note rather than as a second entry, so the stack totals at ONE point on their selectors — see totalOf in app/(marketing)/compare/addOns.js.',
      },
      {
        id: "roofr.addon.instant_estimator",
        label: "Instant Estimator",
        axis: { billing: "monthly_none" },
        price: { kind: PRICE_AMOUNT, amount: 149, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        source: ROOFR_PRICING,
        checked: "2026-09-21",
        observedFrom: "CA",
        verification: VERIFIED,
        verifiedBy: DATA_ATTRIBUTES,
        note:
          'Add-on card: "Instant Estimator — $149/mo or $125/mo billed yearly — Capture leads and give homeowners their first quote faster that your competition." data-monthly="149" data-annual="125". Their FAQ: "the Instant Estimator is available as an add-on and can be added to any plan, even the no-monthly cost Starter plan."',
      },
      {
        id: "roofr.addon.sites",
        label: "Roofr Sites",
        axis: { billing: "monthly_none" },
        price: { kind: PRICE_AMOUNT, amount: 99, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        source: ROOFR_PRICING,
        checked: "2026-09-21",
        observedFrom: "CA",
        verification: VERIFIED,
        verifiedBy: DATA_ATTRIBUTES,
        note:
          'Add-on card: "Roofr Sites — Beta — $99/mo or $85/mo billed yearly — Lead gen made easier with websites that are simple to maintain, and searchable online." data-monthly="99" data-annual="85". Marked Beta on the card.',
      },
      {
        id: "roofr.addon.ai_receptionist",
        label: "AI Receptionist",
        axis: { billing: "monthly_none" },
        price: { kind: PRICE_AMOUNT, amount: 99, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        feature: "ai_receptionist",
        source: ROOFR_PRICING,
        checked: "2026-09-21",
        observedFrom: "CA",
        verification: VERIFIED,
        verifiedBy: DATA_ATTRIBUTES,
        note:
          'Add-on card: "AI Receptionist — $99/mo or $85/mo billed yearly — Calls answered; visits booked; quotes given. Your AI Receptionist has it handled." data-monthly="99" data-annual="85". Not in the owner\'s list; on the page beside the three he named. A monthly floor whether or not a call comes in, like Jobber\'s.',
      },
    ],
    // ══ What is charged per use, on top of the plan ════════════════════════
    //
    // Their FAQ: "Measurement Reports are always pay-as-you-go, no matter
    // which plan you're on." These are not plan figures and they are not
    // add-ons — an add-on is a monthly charge and totalOf() in
    // app/(marketing)/compare/addOns.js rightly refuses to add a per-report
    // price to a per-month one. So they live in their own list, with the same
    // provenance every figure carries, and the page prints them under their
    // own heading, per report, never folded into a monthly number.
    perUseCharges: [
      {
        id: "roofr.report.starter",
        label: "Roofr Report, on Starter",
        unit: "per report",
        onTiers: ["Starter"],
        price: { kind: PRICE_AMOUNT, amount: 19, per: "report", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        source: ROOFR_PRICING,
        checked: "2026-09-21",
        observedFrom: "CA",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          'Measurements table, "Roofr Reports (cost per report) — A detailed report including total squares, pitch, and edges (hips, valleys, ridges, flashing, etc)": $19 in the Starter column, delivered in "24 hr". Footnote: "Delivery time for the free Starter plan is an estimate."',
      },
      {
        id: "roofr.report.paid",
        label: "Roofr Report, on Measure+, Essentials and Scale",
        unit: "per report",
        onTiers: ["Measure+", "Essentials", "Scale"],
        price: { kind: PRICE_AMOUNT, amount: 13, per: "report", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        source: ROOFR_PRICING,
        checked: "2026-09-21",
        observedFrom: "CA",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          'Same row, $13 in every paid column. Delivery "6 hr" on Measure+ 6 Hour, "2 hr" on Measure+ 2 Hour, Essentials and Scale; "Guaranteed delivery is met or the report is free." Rush fees on top of the base: "+$5" for 12 hr and "+$15" for 6 hr on Starter, "+$30" for 2 hr on Starter and "+$15" on Measure+ 6 Hour. "All fees are additional to the report base fee ($13 or $19). Does not include multi-family reports."',
      },
      {
        id: "roofr.report_esx.starter",
        label: "Roofr Report + ESX file, on Starter",
        unit: "per bundle",
        onTiers: ["Starter"],
        price: { kind: PRICE_AMOUNT, amount: 31, per: "report", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        source: ROOFR_PRICING,
        checked: "2026-09-21",
        observedFrom: "CA",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          '"Roofr Report + ESX (cost per bundle) — Includes a standard Roofr Measurement Report and an ESX file. ESX files can be uploaded directly to Xactimate." $31 on Starter. The Starter card separately prints "ESX files $12 USD / report".',
      },
      {
        id: "roofr.report_esx.paid",
        label: "Roofr Report + ESX file, on Measure+, Essentials and Scale",
        unit: "per bundle",
        onTiers: ["Measure+", "Essentials", "Scale"],
        price: { kind: PRICE_AMOUNT, amount: 23, per: "report", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        source: ROOFR_PRICING,
        checked: "2026-09-21",
        observedFrom: "CA",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note: 'Same row, $23 in every paid column. The Measure+ card separately prints "ESX files $10 USD / report".',
      },
    ],
    theyHaveWeDont: [
      {
        capability: "entry_price_below_our_floor",
        claim: "Roofr's Starter plan is $0 a month with no time limit; FieldQuo's cheapest rung is $99",
        sourcing: SOURCED_PUBLISHER,
        source: ROOFR_PRICING,
        checked: "2026-09-21",
        verification: VERIFIED,
        verifiedBy: DATA_ATTRIBUTES,
        note:
          "The clearest loss on this page and it is at zero, which no ladder of ours reaches. Scoped honestly in the note on the figure: Starter caps proposals, invoices and work orders at ten in total, so it is where a roofer looks, not where one runs a business. Both halves belong on the page.",
      },
      {
        capability: "measured_roof_report",
        claim:
          "Roofr sells a measurement report per roof — total squares, pitch, and edges (hips, valleys, ridges, flashing) — delivered in as little as two hours, or the report is free",
        sourcing: SOURCED_PUBLISHER,
        source: ROOFR_PRICING,
        checked: "2026-09-21",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          'Their row: "A detailed report including total squares, pitch, and edges (hips, valleys, ridges, flashing, etc)" and "Guaranteed delivery is met or the report is free." The concession that matters most to a roofer, and the one a page about roofing software would be tempted to answer with our satellite measurement. Ours measures area and pitch and DERIVES the edge split by convention — FIELDQUO_CAPABILITIES.measured_roof_report says so — and a roofer buying material off edge lengths should know which he has. Not claimed: that their report is human-verified. Their page does not say so and neither does this one.',
      },
      {
        capability: "accounting_sync",
        claim: "Roofr's Scale plan lists a QuickBooks integration — marked Beta, US businesses only, no QuickBooks Desktop",
        sourcing: SOURCED_PUBLISHER,
        source: ROOFR_PRICING,
        checked: "2026-09-21",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          'Compare table: "QuickBooks integration — Beta — Export contacts, catalog items, invoices, and payment info. Currently only available to businesses located in the US. Does not support Quickbooks Desktop Integration." ✕ on Essentials, ✓ on Scale. The whole qualification is quoted because a Canadian roofer reading "QuickBooks" without it would be buying something the page says he cannot have.',
      },
      {
        capability: "integration_marketplace",
        claim: "Roofr connects to Zapier and CompanyCam on every plan, Starter included",
        sourcing: SOURCED_PUBLISHER,
        source: ROOFR_PRICING,
        checked: "2026-09-21",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          'Compare table, Integrations: "CompanyCam — Connect your CompanyCam account to sync photos, proposals, Roofr Reports, and more" and "Zapier — Integrate Roofr with your favorite platforms", both Included in all four columns. Their FAQ qualifies the second: "limited Zapier workflows".',
      },
      {
        capability: "self_serve_demo",
        claim: "Roofr's page offers Talk to sales, Book a call and onboarding at no extra charge on the paid plans",
        sourcing: SOURCED_PUBLISHER,
        source: ROOFR_PRICING,
        checked: "2026-09-21",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          '"Don\'t know which plan is best for you? Our team can help you compare. Talk to sales" on the plan row; "Book a call" in the FAQ; compare table "Onboarding & account setup — Get help setting up your account and get to know Roofr at no extra charge" Included on Essentials and Scale, and "Dedicated account manager" likewise.',
      },
    ],
    weHaveTheyDont: [
      {
        capability: "ai_receptionist_no_monthly_floor",
        claim: "Roofr's AI Receptionist is a $99 a month add-on on top of the plan",
        sourcing: SOURCED_PUBLISHER,
        source: ROOFR_PRICING,
        checked: "2026-09-21",
        verification: VERIFIED,
        verifiedBy: DATA_ATTRIBUTES,
        note:
          'Add-on card, data-monthly="99". Same shape as Jobber\'s $29 and the same narrow claim on our side: no monthly floor, not "included" — the talk time is prepaid credit.',
      },
      {
        capability: "payments_in_canada",
        claim: "Roofr Payments is listed as U.S businesses only, and so is their financing partner",
        sourcing: SOURCED_PUBLISHER,
        source: ROOFR_PRICING,
        checked: "2026-09-21",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          'Compare table: "Roofr Payments — Collect credit card and ACH/EFT payments. No hidden fees, no minimums. U.S businesses only." and "GoodLeap integration — Financing options available for U.S. residents." Read from Canada, where most of who FieldQuo competes for lives. Scoped to what the page says: a Canadian roofer is not offered card collection through Roofr. Nothing is claimed about what Roofr may do elsewhere.',
      },
      {
        capability: "white_label_documents",
        claim: "Company logo & branding is listed on Roofr's Measure+ card, not on the free Starter plan",
        sourcing: SOURCED_PUBLISHER,
        source: ROOFR_PRICING,
        checked: "2026-09-21",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          'Measure+ card, "The Starter plan, plus:" list, includes "Company logo & branding". The Starter card does not. Scoped to the entry tier: on FieldQuo the brand is on every document from the cheapest rung.',
      },
    ],
  },

  {
    id: "paintscout",
    name: "PaintScout",
    homepage: "https://www.paintscout.com/",
    // ══ Read on 2026-09-21 from a Canadian connection ══════════════════════
    //
    // The owner's reading matched the page figure for figure: Sales $119/mo
    // monthly and $99/mo annual, an Operations add-on at $99/mo and $79/mo,
    // one user included, $20 per extra user per month, a 14-day trial with no
    // card, Success packages at $999, $1,499 and $1,999, USD. The page prints
    // "Billed Monthly in USD" under each figure and its schema.org Offer markup
    // names priceCurrency USD, so the currency is theirs twice over.
    //
    // Their structured data adds two facts the visible page does not print:
    // operatingSystem "Web", "iOS", "Android" and a featureList entry "Offline
    // mode for field use". Both are concessions and both are recorded below at
    // the standard the Offer markup already set for QuoteIQ — the publisher's
    // own machine-readable statement, on the pricing page itself.
    //
    // PaintScout's Organization markup gives a Calgary, Alberta address. A
    // Canadian company pricing in USD to a Canadian visitor, like Jobber.
    pricingUnit: UNIT_PER_SEAT,
    pricingUnitSourcing: SOURCED_PUBLISHER,
    axes: [AXIS_BILLING],
    geoCaveat:
      "Read from a Canadian connection on 2026-09-21. PaintScout's own structured data places the company in Calgary, Alberta, and every figure on their page is printed \"in USD\" — a Canadian visitor is shown US-dollar prices.",
    figures: [
      {
        id: "paintscout.sales.monthly",
        label: "Sales",
        axis: { billing: "monthly_none" },
        seatsIncluded: 1,
        // The price of a second person, on their page in their words. Recorded
        // as its own figure-shaped field rather than as prose in a note, because
        // shopMath in lib/marketing/parity.js prices a shop with it: a shop of
        // eleven on PaintScout is $119 plus ten of these, and a page that
        // printed $119 for eleven people would be a false price in THEIR favour
        // that also loses us the argument.
        perExtraUser: { amount: 20, per: "month", currency: "USD" },
        price: { kind: PRICE_AMOUNT, amount: 119, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        cta: "Get Started",
        includedFeatures: [
          "Production Rate Estimating",
          "Interactive Proposals",
          "Customer Chat",
          "Sales Leaderboards",
          "Integrated Payments",
          "Automated Email & SMS",
        ],
        featuresSourcing: SOURCED_PUBLISHER,
        source: PAINTSCOUT_PRICING,
        checked: "2026-09-21",
        observedFrom: "CA",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          'Plan card: "Sales — Core Platform — $119/mo — Billed Monthly in USD — Everything you need to sell: Estimates, proposals, payments, follow-ups and customer communication." Beside it "Additional User Pricing — Team seats: $20/user/month" and, under the cards, "1 User". The six bullets are the Feature Breakdown\'s "Key Features" rows ticked in the Sales column; the five ticked only under "Sales + Operations" are on the add-on.',
      },
      {
        id: "paintscout.sales.annual",
        label: "Sales",
        axis: { billing: "annual_prepaid" },
        seatsIncluded: 1,
        perExtraUser: { amount: 20, per: "month", currency: "USD" },
        price: { kind: PRICE_AMOUNT, amount: 99, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        cta: "Get Started",
        source: PAINTSCOUT_PRICING,
        checked: "2026-09-21",
        observedFrom: "CA",
        verification: VERIFIED,
        verifiedBy: STRUCTURED_DATA,
        note:
          '"$99/mo — Billed Annually in USD". The Offer markup: name "Core Platform (Annual)", price "99", priceCurrency "USD", billingDuration "P1Y". The same "$20/user/month" line sits beside the annual card.',
      },
    ],
    addOns: [
      {
        id: "paintscout.addon.operations",
        label: "Operations",
        axis: { billing: "monthly_none" },
        price: { kind: PRICE_AMOUNT, amount: 99, per: "month", currency: "USD", currencySourcing: SOURCED_PUBLISHER },
        source: PAINTSCOUT_PRICING,
        checked: "2026-09-21",
        observedFrom: "CA",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          'Card: "Operations — Add-On — $99/mo — Billed Monthly in USD — Add Operations to: Manage customers and jobs in one place · Stay organized from lead to completion · Schedule jobs and stay on track · Run jobs as smoothly as you sell". The annual toggle prints "$79/mo — Billed Annually in USD", recorded here rather than as a second figure so the stack totals at one point on their selectors. It is the half of their product that runs the job; without it PaintScout is an estimating and sales tool.',
      },
    ],
    theyHaveWeDont: [
      {
        capability: "mobile_app",
        claim: "PaintScout's pricing page declares iOS and Android apps in its own structured data",
        sourcing: SOURCED_PUBLISHER,
        source: PAINTSCOUT_PRICING,
        checked: "2026-09-21",
        verification: VERIFIED,
        verifiedBy: STRUCTURED_DATA,
        note: 'SoftwareApplication markup: "operatingSystem": ["Web", "iOS", "Android"]. FieldQuo is a responsive web app.',
      },
      {
        capability: "offline_use",
        claim: "PaintScout lists offline mode for field use among its features",
        sourcing: SOURCED_PUBLISHER,
        source: PAINTSCOUT_PRICING,
        checked: "2026-09-21",
        verification: VERIFIED,
        verifiedBy: STRUCTURED_DATA,
        note: 'featureList entry "Offline mode for field use" in the same markup. Every FieldQuo screen needs the network.',
      },
      {
        capability: "accounting_sync",
        claim: "PaintScout exports invoices to QuickBooks",
        sourcing: SOURCED_PUBLISHER,
        source: PAINTSCOUT_INTEGRATIONS,
        checked: "2026-09-21",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          'Their integrations page: "Your invoices can be instantly exported to QuickBooks. Your bookkeeping will stay organized, efficient, and up to date with no extra effort." Their pricing page\'s featureList also carries "QuickBooks integration". What we have is a bookkeeping CSV — docs/INTEGRATIONS-ASSESSMENT.md.',
      },
      {
        capability: "integration_marketplace",
        claim: "PaintScout connects to CompanyCam and, through Zapier, to other tools",
        sourcing: SOURCED_PUBLISHER,
        source: PAINTSCOUT_INTEGRATIONS,
        checked: "2026-09-21",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          'Integrations page: "CompanyCam — Once connected, your CompanyCam photos are instantly available in PaintScout" and "Zapier — Connect *almost* any tool/app you work with using Zapier." Google Calendar and Google Sheets are listed "Via Zapier".',
      },
      {
        capability: "community",
        claim: "PaintScout links a community — a Facebook group for pricing painting projects — from its site",
        sourcing: SOURCED_PUBLISHER,
        source: PAINTSCOUT_PRICING,
        checked: "2026-09-21",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          'The pricing page\'s navigation carries "Community" and links facebook.com/groups/pricingpaintingprojects. A place to ask other painters is a real reason to choose a painting-only product, and we have nothing like it.',
      },
      {
        capability: "self_serve_demo",
        claim: "PaintScout's page says to book a personalized demo, and sells three onboarding packages",
        sourcing: SOURCED_PUBLISHER,
        source: PAINTSCOUT_PRICING,
        checked: "2026-09-21",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          '"How do I get started with PaintScout? Book a personalized demo with our team", "Every PaintScout account includes free onboarding", and Success Packages at $999 (Plus), $1,499 (Pro) and $1,999 (Premium) — one-time, optional, each listing production-rates setup, imports and training sessions. The packages are recorded in this note and not as figures: they are not subscription prices and no monthly comparison should carry them.',
      },
    ],
    weHaveTheyDont: [
      {
        capability: "free_crew_seats",
        claim: "PaintScout includes one user and charges $20 a month for each additional team seat; FieldQuo bills only the people who originate money and includes field crew free",
        sourcing: SOURCED_PUBLISHER,
        source: PAINTSCOUT_PRICING,
        checked: "2026-09-21",
        verification: VERIFIED,
        verifiedBy: SERVED_HTML,
        note:
          '"1 User" and "Team seats: $20/user/month", printed beside both billing toggles. Same scope as the QuoteIQ claim: our crew cannot price a job (FIELDQUO_CAPABILITIES.field_worker_quotes), so a painter who needs every van to quote needs a seat here too.',
      },
      {
        capability: "monthly_billing",
        claim: "PaintScout's 14-day trial takes no card; FieldQuo's month is free with a card on file and you leave at the end of any month",
        sourcing: SOURCED_PUBLISHER,
        source: PAINTSCOUT_PRICING,
        checked: "2026-09-21",
        verification: VERIFIED,
        verifiedBy: STRUCTURED_DATA,
        note:
          'Offer markup: "Free Trial … 14-day free trial, no credit card required", and the page footer "Get a 14-day free trial of PaintScout, no credit card required." Recorded against monthly_billing because both halves are about commitment, and recorded in full because the first half is a point in THEIR favour — a trial that asks for no card is easier to start than ours.',
      },
    ],
  },
]);

// ── Lookups ────────────────────────────────────────────────────────────────

export function competitor(id) {
  return COMPETITORS.find((c) => c.id === id) || null;
}

export function allFigures() {
  return COMPETITORS.flatMap((c) => c.figures.map((f) => ({ ...f, competitorId: c.id })));
}

/** Add-ons are priced separately and are not plan figures, but they carry the
 *  same guarantees and the same check applies to them. */
export function allAddOns() {
  return COMPETITORS.flatMap((c) => (c.addOns || []).map((a) => ({ ...a, competitorId: c.id })));
}

/**
 * Charges per use — Roofr's per-report measurement fees — with the same
 * guarantees as a figure and their own list, for the reason `reportedCosts`
 * has one: a renderer walking `figures` or `addOns` must not pick one up by
 * accident. A price per report is not a price per month, and the one function
 * that is allowed to add competitor prices together (totalOf, in
 * app/(marketing)/compare/addOns.js) refuses mixed periods — so keeping these
 * out of `addOns` is what keeps that refusal from ever having to fire.
 */
export function allPerUseCharges() {
  return COMPETITORS.flatMap((c) =>
    (c.perUseCharges || []).map((u) => ({ ...u, competitorId: c.id, competitorName: c.name })),
  );
}

export function publishablePerUseCharges(asOf) {
  return allPerUseCharges().filter((u) => withholdReason(u, asOf) === null);
}

/**
 * Everything a renderer is allowed to print as a price, right now.
 *
 * Regular prices only — see `livePromo` for why a promotional figure never
 * appears here. The renderer should still call `withholdReason` on what it
 * excludes if it wants to say WHY a competitor's row is blank. Showing
 * "Projul — currency not stated" is better comparative advertising than
 * showing nothing, and much better than showing a number.
 */
export function publishableFigures(asOf) {
  return allFigures().filter((f) => withholdReason(f, asOf) === null);
}

/**
 * The competitor tier that actually includes a given feature, at a given point
 * on their axes — NOT the tier whose name sounds like ours.
 *
 * This function is the reason COMPARABLE_FEATURES exists. Matching FieldQuo
 * Scale against "Jobber Grow" because both sit third in their tables compares
 * us against $399 for a plan with no receptionist, which understates our case
 * by $200 and simultaneously credits Grow with a feature it does not have. The
 * comparison a visitor can act on is the one against the cheapest tier that
 * does what ours does.
 *
 * Returns null rather than a near-miss. A feature nobody has checked for on a
 * tier is FEATURE_UNKNOWN and is never treated as absent, so an uninspected
 * cheaper tier cannot win this by default.
 */
export function comparableTier(competitorId, { feature, teamSize, billing }, asOf) {
  const c = competitor(competitorId);
  if (!c || !COMPARABLE_FEATURES[feature]) return null;
  const candidates = c.figures.filter(
    (f) =>
      f.features?.[feature] === FEATURE_INCLUDED &&
      (teamSize === undefined || f.axis?.teamSize === teamSize) &&
      (billing === undefined || f.axis?.billing === billing) &&
      f.price?.kind === PRICE_AMOUNT &&
      withholdReason(f, asOf) === null,
  );
  if (candidates.length === 0) return null;
  return candidates.reduce((best, f) => (f.price.amount < best.price.amount ? f : best));
}

/** Every claim, both directions, for one competitor — already resolved against
 *  the capability ledger so a renderer never has to look a key up itself. */
/** The two directions a comparative claim can point. */
export const CLAIM_CONCESSION = "concession";
export const CLAIM_ADVANTAGE = "advantage";

/**
 * May this claim be printed? Two directions, two evidentiary bars.
 *
 * ══ Why the bar is asymmetric ══════════════════════════════════════════════
 *
 * A CONCESSION ("Projul ships a mobile app and we do not") may rest on the
 * owner's signed assertion. The only party a wrong concession can harm is
 * FieldQuo: we understate ourselves and lose a sale. Holding it to a page read
 * would mean the five inconvenient things his Projul lists named — an app,
 * QuickBooks, Gantt charts, purchase orders, daily logs — quietly do not reach
 * the page, and a comparison that concedes only the cheap point is a brochure.
 *
 * A CLAIM OF ADVANTAGE ("they cannot do X and we can") may not. It is a
 * statement about somebody else's product, published under our name, and it
 * needs their own page behind it. An assertion, however well reasoned, is not
 * their page.
 *
 * ══ Why this is its own exported function ══════════════════════════════════
 *
 * It was a closure inside claims(), and mutation testing walked through it:
 * relaxing the advantage bar to accept an assertion changed nothing anybody
 * could observe, because every advantage claim in the data today happens to be
 * publisher-sourced. A rule that only bites on data that does not exist yet is
 * a rule nothing tests. Pulled out so the check can drive both directions
 * directly with synthetic entries.
 */
export function claimPublishable(entry, direction) {
  if (entry?.verification === VERIFIED) return true;
  if (direction !== CLAIM_CONCESSION) return false;
  // A concession may rest on the owner having asserted it, OR on his having
  // relayed it from their page. Both are signed records with grounds; neither
  // is a page WE read, which is why neither can back an advantage.
  if (entry?.sourcing === SOURCED_OWNER_ASSERTED) return isSignedAssertion(entry.assertedBy);
  if (entry?.sourcing === SOURCED_OWNER_RELAYED) return isSignedAssertion(entry.relayedBy);
  return false;
}

export function claims(competitorId) {
  const c = competitor(competitorId);
  if (!c) return null;
  const resolve = (list, expectHas, direction) =>
    list.map((entry) => {
      const cap = FIELDQUO_CAPABILITIES[entry.capability];
      const publishable = claimPublishable(entry, direction);
      return {
        ...entry,
        fieldquoHas: cap ? cap.has : null,
        // A claim whose ledger entry points the wrong way is a claim about
        // ourselves that is false. Surfaced rather than silently dropped so a
        // renderer that ignores it still fails the check, not the visitor.
        consistent: Boolean(cap) && cap.has === expectHas,
        publishable,
        sourcing: entry.sourcing || null,
        // Never blank, so a renderer has no excuse for printing an asserted
        // claim as though it came off their page.
        provenance: provenanceLabel(entry, { subject: c.name }),
      };
    });
  return {
    theyHaveWeDont: resolve(c.theyHaveWeDont, false, CLAIM_CONCESSION),
    weHaveTheyDont: resolve(c.weHaveTheyDont, true, CLAIM_ADVANTAGE),
  };
}

// ── The third tier's own lookups ───────────────────────────────────────────
//
// Deliberately parallel to allFigures/publishableFigures rather than folded
// into them. A caller has to ASK for third-hand material by name; there is no
// call that returns publisher figures and user reports mixed together, because
// the first thing such a list loses is which is which.

export function allReportedCosts() {
  return COMPETITORS.flatMap((c) =>
    (c.reportedCosts || []).map((r) => ({ ...r, competitorId: c.id, competitorName: c.name })),
  );
}

export function publishableReportedCosts(asOf) {
  return allReportedCosts().filter((r) => reportedWithholdReason(r, asOf) === null);
}

/** The structural terms — per-technician, implementation fee, annual contract.
 *  Carry no numbers at all, which is why they are the part of the third-hand
 *  material that can be leaned on. */
export function allReportedTerms() {
  return COMPETITORS.flatMap((c) =>
    (c.reportedTerms || []).map((t) => ({ ...t, competitorId: c.id, competitorName: c.name })),
  );
}
